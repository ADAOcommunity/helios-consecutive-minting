
import { Lucid } from 'lucid-cardano';
import { useState, useEffect } from 'react'
import { CustomerData, ServiceData } from '../utils/contract';
import initLucid from '../utils/lucid';
import { useStoreActions, useStoreState } from "../utils/store";
import SubscriptionRow from './SubscriptionRow';
// table where the customer can see his active subscriptions
const CustomerTable = (props: any) => {
    const subscriptionList = props.subscriptionList
    const [lucid, setLucid] = useState<Lucid>()
    const walletStore = useStoreState((state: any) => state.wallet)

    useEffect(() => {
        if (!lucid) {
            initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
        } else {
            console.log("connected")
        }
    }, [lucid, walletStore.name])
    return (
        <>
            {subscriptionList.length > 0 &&
                <div className="overflow-x-auto my-5">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Vendor Pubkey Hash</th>
                                <th>Subscribed</th>
                                <th>Remaining Periods</th>
                                <th>Locked Funds</th>
                                <th>Cancel Subscription</th>
                                <th>Add Time To Subscription</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptionList.map((vendor: ServiceData) => {
                                return <SubscriptionRow vendor={vendor} vendorAddress={props.vendorAddress} scriptAddress={props.scriptAddress} lucid={lucid}/>
                            })}
                        </tbody>
                    </table>
                </div>}
                {subscriptionList.length === 0 && 
                <div>No subscriptions</div>}

        </>
    )
}

export default CustomerTable;