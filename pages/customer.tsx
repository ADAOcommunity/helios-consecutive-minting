
import { Lucid, SpendingValidator } from 'lucid-cardano';
import { NextPage } from 'next';
import { useEffect, useState } from 'react';
import CustomerTable from '../components/CustomerTable';
import WalletConnect from '../components/WalletConnect';
import { CustomerData, getCompiledProgram, getCustomerSubscriptions, ServiceData } from '../utils/contract';
import initLucid from '../utils/lucid';
import { useStoreState } from '../utils/store';
///IDEA: Poner un seleccioandor para qu eel vendor pueda ingresar su address, en lugar de solo conectarlo?
const CustomerPage: NextPage = () => {
    const [customerAddress, setCustomerAddress] = useState("")
    const [subscriptionList, setSubscriptionList] = useState<ServiceData[]>([])
    const [lucid, setLucid] = useState<Lucid>()
    const walletStore = useStoreState((state: any) => state.wallet)
    const [scriptAddress, setScriptAddress] = useState<string>("")
    useEffect(() => {
        if (!lucid) {
            initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
        } else {
            const thisScript: SpendingValidator = {
                type: "PlutusV2",
                script: JSON.parse(getCompiledProgram().serialize()).cborHex,
            };
            const scriptAddr = lucid.utils.validatorToAddress(thisScript)
            setScriptAddress(scriptAddr)
            setCustomerAddress(walletStore.address)
            getSubscriptionList(walletStore.address, scriptAddr)
        }
    }, [lucid, walletStore.name, walletStore.address])

    const getSubscriptionList = async (customerAddress: string, scriptAddress: string) => {
        const utxos = await lucid!.utxosAt(scriptAddress)
        const subscriptions = await getCustomerSubscriptions(lucid!, customerAddress, utxos)
        console.log(utxos)
        setSubscriptionList(subscriptions)
    }

    return (
        <>
            <WalletConnect />
            {/* <input type="text" onChange={(e) => { setCustomerAddress(e.target.value) }} value={customerAddress} placeholder="Enter vendor address" className="input input-bordered input-primary w-full max-w-xs" />
            <button disabled={!customerAddress.startsWith("addr")} className={`btn btn-primary`} onClick={() => { getSubscriptionList(walletStore.address)}} >Search</button> */}
            <CustomerTable subscriptionList={subscriptionList} scriptAddress={scriptAddress} customerAddress={customerAddress} />
        </>
    )
}

export default CustomerPage;