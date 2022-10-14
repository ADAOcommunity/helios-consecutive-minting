
import { Lucid } from 'lucid-cardano';
import { useState, useEffect } from 'react'
import initLucid from '../utils/lucid';
import { useStoreActions, useStoreState } from "../utils/store";

// Table where the vendor can see his subscribed customers
const LotteryCard = (props: any) => {
    const customerList = props.customerList
    const [lucid, setLucid] = useState<Lucid>()
    const walletStore = useStoreState((state: any) => state.wallet)

    useEffect(() => {
        /*      if (!lucid) {
                 initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
             } else {
                 console.log("connected")
             } */
    }, [lucid, walletStore.name])
    return (
        <>
            <div className="stats bg-secondary text-primary-content">
                <div className="stat">
                <h1 className="text-xl text-bold text-accent" >Pool 1</h1>
                    <div className="stat-title">Pooled amount</div>
                    <div className="stat-value">$89,400</div>
                    <div className="stat-actions">
                        <button className="btn btn-sm btn-neutral">Buy ticket</button>
                    </div>
                </div>
                <div className="stat">
                    <div className="mb-5">
                        <div className="stat-title">Price</div>
                        <div className="stat-value">10 ADA</div>
                    </div>


                    <div className="mb-5">
                        <div className="stat-title">Participants</div>
                        <div className="stat-value">300/500</div>
                        <div className="stat-desc">From January 1st to February 1st</div>
                    </div>
                   {/*  <div className="mb-0">
                        <div className="stat-actions">
                            <button className="btn btn-sm">Withdrawal</button>
                            <button className="btn btn-sm">deposit</button>
                        </div>
                    </div> */}
                </div>

            </div>

        </>
    )
}

export default LotteryCard;