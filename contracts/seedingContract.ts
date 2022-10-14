
const optimize = false;
import { MintingPolicyHash, Program, PubKeyHash, UplcData, UplcDataValue } from '@hyperionbt/helios'
import { C, toHex } from 'lucid-cardano';

export const contractScript = (SELLER_BYTES: string) => ` 
minting  seed_token

const seller_pubkey: PubKeyHash = PubKeyHash::new(${SELLER_BYTES})

func main(ctx: ScriptContext) -> Bool {
    tx: Tx = ctx.tx;
    nft_assetclass: AssetClass = AssetClass::new(
        ctx.get_current_minting_policy_hash(), 
        "thread".encode_utf8()
    );
    print(ctx.get_current_minting_policy_hash().show());
    value_minted: Value = tx.minted;
    value_minted == Value::new(nft_assetclass, 1) &&
    tx.is_signed_by(seller_pubkey)
}`;


export const generateContract = (sellerPkh: string): any => {
    let SELLER_BYTES = "#" // must be
    if (sellerPkh === null) {
        throw new Error("unexpected null sellerPkh");
    } else {
        SELLER_BYTES = "#"+sellerPkh
    }
    const contract = contractScript(SELLER_BYTES)
    const program = Program.new(contract);

    return program.compile(optimize);
}
