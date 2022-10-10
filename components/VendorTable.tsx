
import { Lucid } from 'lucid-cardano';
import { useState, useEffect } from 'react'
import { CustomerData } from '../utils/contract';
import initLucid from '../utils/lucid';
import { useStoreActions, useStoreState } from "../utils/store";
import ClientRow from './ClientRow';

// Table where the vendor can see his subscribed customers
const VendorTable = (props: any) => {
    const customerList = props.customerList
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
            {customerList.length > 0 &&
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Customer pubkey hash</th>
                                <th>Subscribed</th>
                                <th>Claimable Periods</th>
                                <th>Claimable Amount</th>
                                <th>Locked Funds</th>
                                <th>Redeem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerList.map((customer: CustomerData) => {
                                return <ClientRow customer={customer} vendorAddress={props.vendorAddress} scriptAddress={props.scriptAddress} lucid={lucid}/>
                            })}
                        </tbody>
                    </table>
                </div>}
                {customerList.length === 0 && 
                <div>No subscriptions</div>}

        </>
    )
}

export default VendorTable;