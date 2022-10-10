
import { Data, UTxO } from 'lucid-cardano';
import { useEffect, useState } from 'react'
import { useStoreActions, useStoreState } from "../utils/store";
import { generateDatum } from '../utils/contract';
import MessageModal from './MessageModal';



const SubscriptionRow = (props: any) => {
    const vendor = props.vendor
    const customerAddress = props.customerAddress
    const vendorAddress = props.vendorAddress
    const [price, setPrice] = useState(0)
    const [intervalDays, setIntervalDays] = useState(0)
    const lucid = props.lucid
    const walletStore = useStoreState((state: any) => state.wallet)
    const [displayMessage, setDisplayMessage] = useState<{ title: string, message: string }>({ title: "", message: "" })
    const [showModal, setShowModal] = useState<boolean>(false)

    useEffect(() => {
        console.log("scriptAddr", props.scriptAddress)
        const refDatum = vendor.subscriptionData!.refDatum
        console.log("ref", refDatum)
        const days = Math.round(Number(refDatum.interval) / 1000 / 60 / 60 / 24)
        setIntervalDays(days)
        const retrievedPrice = Number(refDatum!.price)
        setPrice(retrievedPrice)
    }, [])
    const redeemUtxo = async () => {
        if (lucid) {
            const vendorPkh = vendor.vendorPkh
            const customerPkh = lucid!.utils.getAddressDetails(
                walletStore.address,
            ).paymentCredential?.hash!
            const oldestUtxo = vendor.subscriptionData!.oldestUtxo
            const utxo = vendor.subscriptionData!.utxos
            const refUtxo = vendor.subscriptionData!.refUtxo
            const refDatum = vendor.subscriptionData!.refDatum
            console.log("ref", refDatum)
            const days = Math.round(Number(refDatum.interval) / 1000 / 60 / 24)

            const reconstructedDatum = oldestUtxo.datum
            console.log(reconstructedDatum)
            let valueUnlocked = 0
            for (let output of utxo) {
                valueUnlocked += Number(output.assets.lovelace)
            }
            // const valueUnlocked = Number(utxo!.assets.lovelace)
            console.log(valueUnlocked)
            const retrievedFunds = Number(reconstructedDatum!.funds)
            const retrievedPrice = Number(refDatum!.price)
            const newFunds = { "lovelace": BigInt(retrievedFunds) }
            const newNextWithdrawal = Number(reconstructedDatum!.next_withdrawal) + Number(reconstructedDatum!.interval)
            const newPrice = { "lovelace": BigInt(retrievedPrice) }
            //console.log(reconstructedDatum!.funds.get("").get(""))
            console.log("RetrievedFunds", retrievedFunds)
            console.log(customerPkh, vendorPkh, newFunds, newPrice, refDatum!.interval, new Date(newNextWithdrawal).getTime().toString())
            const generatedDatum = generateDatum(customerPkh, vendorPkh, newFunds, newPrice, reconstructedDatum!.interval, new Date(Number(reconstructedDatum!.next_withdrawal)))
            console.log("datums", oldestUtxo.utxo.datum === generatedDatum)
            const toPayBack = { "lovelace": BigInt(valueUnlocked - retrievedPrice) }
            console.log(toPayBack)
            const tx = await lucid.newTx()
                .collectFrom(utxo!, Data.empty())
                .addSigner(walletStore.address)
                .validFrom(Date.now() - 120000)
                .validTo(Date.now() + 360000)
                // .payToContract(props.scriptAddress, { inline: generatedDatum }, {lovelace:BigInt(15000000)})
                .readFrom([refUtxo])
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
                {/* <th>Vendor Pubkey Hash</th>
                <th>Subscribed</th>
                <th>Remaining Periods</th>
                <th>Locked Funds</th>
                <th>Cancel Subscription</th>
                <th>Add Time To Subscription</th> */}
                <td>{vendor.vendorPkh}</td>
                <td>{vendor.subscriptionData.isSubscribed ? "Yes" : "No"}</td>
                <td>{vendor.subscriptionData.remainingPeriods}</td>
                <td>{(vendor.subscriptionData.lockedFunds / 1000000).toFixed(3)} ADA</td>
                <td><button disabled={vendor.subscriptionData.claimableAmount == 0 || !lucid} className={`btn btn-accent `} onClick={() => { redeemUtxo() }} >Cancel</button></td>
                <td><a href={`/subscription?vendorpkh=${vendor.vendorPkh}&price=${price}&intervalDays=${intervalDays}`} target="_blank" ><button disabled={vendor.subscriptionData.claimableAmount == 0 || !lucid} className={`btn btn-primary `} >Add</button></a></td>
            </tr>
        </>
    )
}

export default SubscriptionRow;