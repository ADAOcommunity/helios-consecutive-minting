
import { Lucid, SpendingValidator } from 'lucid-cardano';
import { NextPage } from 'next';
import { useEffect, useState } from 'react';
import VendorTable from '../components/VendorTable';
import WalletConnect from '../components/WalletConnect';
import { CustomerData, getCompiledProgram, getVendorSubscriptions } from '../utils/contract';
import initLucid from '../utils/lucid';
import { useStoreState } from '../utils/store';
///IDEA: Poner un seleccioandor para qu eel vendor pueda ingresar su address, en lugar de solo conectarlo?
const VendorPage: NextPage = () => {
    const [vendorAddress, setVendorAddress] = useState("")
    const [customerList, setCustomerList] = useState<CustomerData[]>([])
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
            console.log(scriptAddr)
            setScriptAddress(scriptAddr)
            setVendorAddress(walletStore.address)
            getCustomerList(walletStore.address, scriptAddr)
        }
    }, [lucid, walletStore.name, walletStore.address])

    const getCustomerList = async (vendorAddress: string, scriptAddress: string) => {
        const utxos = await lucid!.utxosAt(scriptAddress)
        const customers = await getVendorSubscriptions(lucid!, vendorAddress, utxos)
        setCustomerList(customers)
    }

    return (
        <>
            <WalletConnect />
            <input type="text" onChange={(e) => { setVendorAddress(e.target.value) }} value={vendorAddress} placeholder="Enter vendor address" className="input input-bordered input-primary w-full max-w-xs" />
            <button disabled={!vendorAddress.startsWith("addr")} className={`btn btn-primary`} onClick={() => { getCustomerList(vendorAddress, scriptAddress)}} >Search</button>
            <VendorTable customerList={customerList} scriptAddress={scriptAddress} vendorAddress={vendorAddress} />
        </>
    )
}

export default VendorPage;