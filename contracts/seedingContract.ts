
const optimize = true;
import { Program } from '@hyperionbt/helios'

export const contractScript = (SELLER_BYTES: string, tokenName: string) => ` 
minting  seed_token

const seller_pubkey: PubKeyHash = PubKeyHash::new(${SELLER_BYTES})

func main(ctx: ScriptContext) -> Bool {
    tx: Tx = ctx.tx;
    tx.is_signed_by(seller_pubkey)
}`;


export const generateContract = (sellerPkh: string, collectionName: string): any => {
    let SELLER_BYTES = "#" // must be
    if (sellerPkh === null) {
        throw new Error("unexpected null sellerPkh");
    } else {
        SELLER_BYTES = "#"+sellerPkh
    }
    const contract = contractScript(SELLER_BYTES, `"${collectionName}"`)
    const program = Program.new(contract);

    return program.compile(optimize);
}
