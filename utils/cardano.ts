import { getAddressDetails, UTxO } from "lucid-cardano";

export const getInputsFromPkh = async(txHash: string, addressPkh: string) =>{
    var inputsFromAddr = [];
    const data = await fetch(
        `https://cardano-testnet.blockfrost.io/api/v0/txs/${txHash}/utxos`,
        {
            headers: {
                // Your Blockfrost API key
                project_id: process.env.NEXT_PUBLIC_BLOCKFROST!,
                'Content-Type': 'application/json'
            }
        }
    ).then(res => res.json());
    console.log(data)
    if (data?.error) {
        // Handle error.
        console.log("error")
    } else {
        inputsFromAddr = data.inputs.filter((input: UTxO)=>{
            let utxoAddrPkh = getAddressDetails(
                input.address,
            ).paymentCredential?.hash!
            return utxoAddrPkh === addressPkh
        })
    }
    return inputsFromAddr
}
