
const optimize = false;
import { MintingPolicyHash, Program, PubKeyHash } from '@hyperionbt/helios'
import { C, Data, fromHex, toHex } from 'lucid-cardano';

export interface ReconstructedDatum {
    tokenName: string
    mintingPolicyHash: string
    maxSupply: number
    sellerPkh: string
    price: number
    count: number
    sellerAddress: string
}

export const mintingContract = ` 
minting  consecutive_mint

const THREAD_POLICY_BYTES = #
const thread_nft: Value = Value::new(AssetClass::new(MintingPolicyHash::new(THREAD_POLICY_BYTES), ("thread").encode_utf8()), 1)

func main(ctx: ScriptContext) -> Bool {
    tx: Tx = ctx.tx;
    print("hello");
    tx.outputs.head.value.contains(thread_nft)
}`;

const threadContract = `
spending thread_contract

//const THREAD_POLICY_BYTES = #
//const thread_nft: Value = Value::new(AssetClass::new(MintingPolicyHash::new(THREAD_POLICY_BYTES), ("thread").encode_utf8()), 1)
struct Datum {
    token_name:          String                      //the name of the nft collection
    minting_policy_hash: MintingPolicyHash  //the policy hash of the nft collection
    max_supply:          Int                         //max supply of the nft collection
    thread_nft:          Value                    //Value of the thread token that will be attached to the datum with the count
    seller_pubkey:       PubKeyHash
    price:               Int
    count:               Int
    seller_address:      String

    func next_datum(self, to_add: Int) -> Datum {
        print((self.token_name+(self.count+1).show()).encode_utf8().show());
        print(self.minting_policy_hash.show());
        Datum {
            token_name: self.token_name,
            minting_policy_hash: self.minting_policy_hash,
            max_supply: self.max_supply,
            thread_nft:  self.thread_nft,
            seller_pubkey:     self.seller_pubkey,
            price: self.price,
            count: self.count + to_add,
            seller_address: self.seller_address
        }
    }
    func paied_price(self, tx: Tx) -> Bool {
        sent_to_seller: Value = tx.value_sent_to(self.seller_pubkey);
        sent_to_seller.get(AssetClass::ADA) >= self.price
    }
    func includes_thread_nft(self, ctx: ScriptContext, tx: Tx, new_datum: Datum) -> Bool {
        contract_hash: ValidatorHash = ctx.get_current_validator_hash();
        locked_by_datum: Value = tx.value_locked_by_datum(contract_hash, new_datum, true);
        locked_by_datum.contains(self.thread_nft)
    }
    func increased_correctly(self, to_add: Int, ctx: ScriptContext, tx: Tx) -> Bool {
        value_minted: Value = tx.minted;
        new_datum: Datum = self.next_datum(to_add);
        nft_assetclass: AssetClass = AssetClass::new(
            self.minting_policy_hash, 
            (self.token_name+new_datum.count.show()).encode_utf8()
        );
        print(self.includes_thread_nft(ctx, tx, new_datum).show());
        value_minted == Value::new(nft_assetclass, 1) &&
        self.includes_thread_nft(ctx, tx, new_datum)
    }
}

func main(datum: Datum, ctx: ScriptContext) -> Bool {
    tx: Tx = ctx.tx;
    datum.increased_correctly(1, ctx, tx) &&
    datum.paied_price(tx)
}
`

const datumScript = `
// code to generate a Datum for a new nft mint

const NAME = ""
const SUPPLY = 0
const SELLER_BYTES = # // must be 28 bytes long
const SELLER_ADDRESS = ""
const THREAD_POLICY_BYTES = #
const NFT_POLICY_BYTES = #
const PRICE = 0
const COUNT = 0
const DATUM: Datum = Datum {
    token_name: NAME,
    minting_policy_hash: MintingPolicyHash::new(NFT_POLICY_BYTES),
    max_supply: SUPPLY,
    thread_nft:  Value::new(AssetClass::new(MintingPolicyHash::new(THREAD_POLICY_BYTES), ("thread").encode_utf8()), 1),
    seller_pubkey:     PubKeyHash::new(SELLER_BYTES),
    price: PRICE,
    count: COUNT,
    seller_address: SELLER_ADDRESS
}
`;

const src = threadContract + datumScript;

export const generateMintingContractWithParams = (threadPolicy: string): any => {
    const program = Program.new(mintingContract);

    if (threadPolicy === null) {
        throw new Error("unexpected null verification policy");
    } else {
        let policy = MintingPolicyHash.fromHex(threadPolicy)
        program.changeParam("THREAD_POLICY_BYTES", JSON.stringify(policy.bytes))
        //program.changeParam("THREAD_POLICY_BYTES", "#" + threadPolicy)
    }
    console.log(program.toString());
    return program.compile(optimize);
}

export const generateThreadContract = (): any => {
    const program = Program.new(threadContract);
    return program.compile(optimize);
}

export const generateDatum = (sellerPkh: string, sellerAddress: string, supply: number, tokenName: string, threadPolicy: string, nftPolicy: string, price: number, newCount: number): string => {
    const program = Program.new(src);
    program.changeParam("NAME", `"${tokenName}"`);

    if (sellerPkh === null) {
        throw new Error("unexpected null sellerPkh");
    } else {
        let pkh = PubKeyHash.fromHex(sellerPkh)
        program.changeParam("SELLER_BYTES", JSON.stringify(pkh.bytes));
    }
    if (threadPolicy === null) {
        throw new Error("unexpected null verification policy");
    } else {
        let policy = MintingPolicyHash.fromHex(threadPolicy)
        program.changeParam("THREAD_POLICY_BYTES", JSON.stringify(policy.bytes))
    }

    if (nftPolicy === null) {
        throw new Error("unexpected null nft policy");
    } else {
        let policy = MintingPolicyHash.fromHex(nftPolicy)
        program.changeParam("NFT_POLICY_BYTES", JSON.stringify(policy.bytes))
    }
    program.changeParam("SUPPLY", supply.toString())
    program.changeParam("COUNT", newCount.toString())
    program.changeParam("PRICE", price.toString())
    program.changeParam("SELLER_ADDRESS", JSON.stringify(sellerAddress))


    console.log(program.evalParam("DATUM").data.toSchemaJson())
    return toHex(C.encode_json_str_to_plutus_datum(program.evalParam("DATUM").data.toSchemaJson(), 1).to_bytes())
}

export const reconstructDatum = (datumCbor: string) => {
    let fields = (Data.from(datumCbor) as any).fields
    let datumJson: ReconstructedDatum = {
        tokenName: Buffer.from(fromHex(fields[0])).toString("ascii"),
        mintingPolicyHash: fields[1],
        maxSupply: Number(fields[2]),
        sellerPkh: fields[4],
        price: Number(fields[5]),
        count: Number(fields[6]),
        sellerAddress: Buffer.from(fromHex(fields[7])).toString("ascii")
    }
    return datumJson;
}