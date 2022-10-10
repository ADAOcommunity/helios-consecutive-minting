import type { NextPage } from 'next'
import WalletConnect from '../components/WalletConnect'
import { useStoreActions, useStoreState } from "../utils/store"
import { useState, useEffect } from 'react'
import initLucid from '../utils/lucid'
import { Lucid, SpendingValidator, Data, UTxO } from 'lucid-cardano'

import { getCompiledProgram, generateDatum, SubscriptionData, UTxOWithDatum, reconstructDatum, getSubscriptionData } from '../utils/contract'

const CreateSubscription: NextPage = () => {

  const walletStore = useStoreState((state: any) => state.wallet)
  const [lucid, setLucid] = useState<Lucid>()
  const [script, setScript] = useState<SpendingValidator>()
  const [scriptAddress, setScriptAddress] = useState("")
  const [vendorPkh, setVendorPkh] = useState<string>("")
  const [intervalDays, setIntervalDays] = useState(0)
  const [price, setPrice] = useState<number>(0)
  const [url, setUrl] = useState<string>("")
  const[hostname, setHostname] = useState<string>("")

  useEffect(() => {
    if (lucid) {
      const thisScript: SpendingValidator = {
        type: "PlutusV2",
        script: JSON.parse(getCompiledProgram().serialize()).cborHex,
      };
      setScript(thisScript)
      console.log(lucid.utils.validatorToAddress(thisScript))
      setScriptAddress(lucid.utils.validatorToAddress(thisScript))

      const vendorPaymentCredential = lucid.utils.getAddressDetails(
        walletStore.address,
      ).paymentCredential;
      const vendPkh = vendorPaymentCredential?.hash!
      setVendorPkh(vendPkh)

      
    } else {
      initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
    }
  }, [lucid, walletStore.address])

  const lockUtxo = async (vendorPkh: string, customerPkh: string) => {
    if (lucid) {
      const funds = { lovelace: BigInt(1) }
      const priceValue = { "lovelace": BigInt(price * 1000000) }
      const intervalMs = BigInt(intervalDays * 24 * 60 * 60 * 1000)
      const generatedDatum = generateDatum(customerPkh, vendorPkh, funds, priceValue, intervalMs, new Date(Date.now()))
      const tx = await lucid.newTx()
        .payToContract(scriptAddress, {
          inline: generatedDatum,
          scriptRef: script, // adding plutusV2 script to output
        }, { lovelace: BigInt(0) })
        .complete();
      const signedTx = await tx.sign().complete();
      const txHash = await signedTx.submit();
      console.log(txHash);
      if (txHash) {
        setUrl(`${process.env.NEXT_PUBLIC_BASE_URL}/subscription?vendorpkh=${vendorPkh}&price=${price * 1000000}&intervalDays=${intervalDays}`)
      }
    }

  }


  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col ">
        <div className="card flex-shrink-0 w-full max-w-lg shadow-2xl bg-base-100">
          <div className="card-body">
            <div className="text-center lg:text-left">
              <h1 className="text-5xl font-bold">Create your subscription</h1>
              <p className="py-4 break-all max-w-fit">Connect your wallet.</p>
              <WalletConnect />
              <h1 className="text-2xl font-bold">Period size(days):</h1>
              <input type="number" placeholder="0" value={intervalDays} onChange={(e) => { setIntervalDays(parseInt(e.target.value)) }} className="input input-bordered input-primary my-3 w-sm max-w-xs" />
              <h1 className="text-2xl font-bold">Price per period:</h1>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Enter amount</span>
                </label>
                <label className="input-group">
                  <input type="number" placeholder="0" value={price} onChange={(e) => { setPrice(parseInt(e.target.value)) }} className="input input-bordered input-primary " />
                  <span>ADA</span>
                </label>
              </div>
            </div>
            <div className="form-control mt-6">
              <button disabled={!lucid || price === 0 || intervalDays === 0} className={`btn btn-primary `} onClick={() => { lockUtxo(vendorPkh, vendorPkh) }} >Create subscription</button>
            </div>
            <h1 className="text-xl font-bold">Use the URL below to your prospects:</h1>
            <input type="text" placeholder="" value={url} className="input display-none input-bordered input-primary my-3 w-sm max-w-xs" />

          </div>

        </div>
      </div>
    </div>
  )
}

export default CreateSubscription