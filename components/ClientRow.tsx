
import { Data, UTxO } from 'lucid-cardano';
import { useState } from 'react'
import { useStoreActions, useStoreState } from "../utils/store";
import { generateDatum } from '../utils/contract';
import MessageModal from './MessageModal';



const ClientRow = (props: any) => {
    const customer = props.customer
    const vendorAddress = props.vendorAddress
    const lucid = props.lucid
    const walletStore = useStoreState((state: any) => state.wallet)
    const [displayMessage, setDisplayMessage] = useState<{ title: string, message: string }>({ title: "", message: "" })
    const [showModal, setShowModal] = useState<boolean>(false)

    const redeemUtxo = async () => {
        if (lucid) {
            const customerPkh = customer.customerPkh
            const vendorPkh = lucid!.utils.getAddressDetails(
                vendorAddress,
            ).paymentCredential?.hash!
            const oldestUtxo = customer.subscriptionData!.oldestUtxo
            const utxo = oldestUtxo.utxo
            const refUtxo = customer.subscriptionData!.refUtxo
            console.log("filtered", utxo)

            /* const referenceScriptUtxo = (await lucid.utxosAt(props.scriptAddress)).find(
                (utxo: UTxO) => Boolean(utxo.scriptRef),
            );
            if (!referenceScriptUtxo) throw new Error("Reference script not found"); 
            console.log(referenceScriptUtxo) */
            const reconstructedDatum = oldestUtxo.datum
            console.log(reconstructedDatum)
            const valueUnlocked = Number(utxo!.assets.lovelace)
            console.log(valueUnlocked)
            const retrievedFunds = Number(reconstructedDatum!.funds)
            const retrievedPrice = Number(reconstructedDatum!.price)
            const newFunds = { "lovelace": BigInt(retrievedFunds - retrievedPrice) }
            const newNextWithdrawal = Number(reconstructedDatum!.next_withdrawal) + Number(reconstructedDatum!.interval)
            const newPrice = { "lovelace": BigInt(retrievedPrice) }
            //console.log(reconstructedDatum!.funds.get("").get(""))
            console.log("RetrievedFunds", retrievedFunds)
            console.log(customerPkh, vendorPkh, newFunds, newPrice, reconstructedDatum!.interval, new Date(newNextWithdrawal).getTime().toString())
            const generatedDatum = generateDatum(customerPkh, vendorPkh, newFunds, newPrice, reconstructedDatum!.interval, new Date(newNextWithdrawal))

            const toPayBack = { "lovelace": BigInt(valueUnlocked - retrievedPrice) }
            console.log(toPayBack)
            const tx = await lucid.newTx()
                .collectFrom([utxo!], Data.empty())
                .payToAddress(props.vendorAddress, { lovelace: retrievedPrice })
                .addSigner(walletStore.address)
                .validFrom(Date.now() - 120000)
                .validTo(Date.now() + 360000)
                .readFrom([refUtxo])
                .payToContract(props.scriptAddress, { inline: generatedDatum }, toPayBack)
                .complete({ nativeUplc: false });

            const signedTx = await tx.sign().complete();
            const txHash = await signedTx.submit()
            setDisplayMessage({ title: "Transaction submitted", message: `Tx hash: ${txHash}` })
            setShowModal(true)
            console.log(txHash);
        }
    }
    return (
        <>
            <MessageModal message={displayMessage.message} active={showModal} title={displayMessage.title} />
            <tr>
                <td>{customer.customerPkh}</td>
                <td>{customer.subscriptionData.isSubscribed ? "Yes" : "No"}</td>
                <td>{customer.subscriptionData.claimablePeriods}</td>
                <td>{(customer.subscriptionData.claimableAmount / 1000000).toFixed(3)} ADA</td>
                <td>{(customer.subscriptionData.lockedFunds / 1000000).toFixed(3)} ADA</td>
                <td><button disabled={customer.subscriptionData.claimableAmount == 0 || !lucid} className={`btn btn-accent `} onClick={() => { redeemUtxo() }} >Redeem</button></td>
            </tr>
        </>
    )
}

export default ClientRow;