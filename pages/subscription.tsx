import type { NextPage } from 'next'
import WalletConnect from '../components/WalletConnect'
import { useStoreActions, useStoreState } from "../utils/store"
import { useState, useEffect } from 'react'
import initLucid from '../utils/lucid'
import { Lucid, SpendingValidator, Data, UTxO } from 'lucid-cardano'

import { getCompiledProgram, generateDatum, SubscriptionData, UTxOWithDatum, reconstructDatum, getSubscriptionData } from '../utils/contract'
import { useRouter } from 'next/router'
import { calculateTotalPrice } from '../utils/contract'
import Link from 'next/link'
import MessageModal from '../components/MessageModal'

const Subscription: NextPage = () => {
  const router = useRouter();

  const walletStore = useStoreState((state: any) => state.wallet)
  const [lucid, setLucid] = useState<Lucid>()
  const [script, setScript] = useState<SpendingValidator>()
  const [scriptAddress, setScriptAddress] = useState("")
  const [disabled, setDisabled] = useState<boolean>(false)
  const vendorPkh = router.query["vendorpkh"] as string;
  const intervalDays = parseInt(router.query["intervalDays"] as string);
  const price = parseInt(router.query["price"] as string);
  //const [vendorPkh, setVendorPkh] = useState<string>("")
  const [customerPkh, setCustomerPkh] = useState<string>("")
  const [selectedPeriods, setSelectedPeriods] = useState<number>(1)
  const [totalPrice, setTotalPrice] = useState<string>("0")
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>()
  const [subscriptionStart, setSubscriptionStart] = useState(Date.now())
  const [displayMessage, setDisplayMessage] = useState<{title: string, message: string}>({title:"", message:""})
  const [showModal, setShowModal] = useState<boolean>(false)

  const selectPeriods = (periodValue: number) => {
    console.log(periodValue)
    if (isNaN(periodValue) || periodValue === 0) {
      setTotalPrice("0")
      setDisabled(true)
    } else if (walletStore.address) {
      const funds = calculateTotalPrice(periodValue, price)
      setTotalPrice((Number(funds.lovelace) / 1000000).toFixed(4))
      setDisabled(false)
    }
    setSelectedPeriods(periodValue < 0 ? 1 : periodValue);
  }
  useEffect(() => {
    console.log("show modal", showModal)
  }, [showModal])

  useEffect(() => {
    if (lucid) {
      setTotalPrice((price / 1000000).toFixed(4))
      const thisScript: SpendingValidator = {
        type: "PlutusV2",
        script: JSON.parse(getCompiledProgram().serialize()).cborHex,
      };
      setScript(thisScript)
      console.log(lucid.utils.validatorToAddress(thisScript))
      let scriptAddr = lucid.utils.validatorToAddress(thisScript)
      setScriptAddress(scriptAddr)

      const customerPaymentCredential = lucid.utils.getAddressDetails(
        walletStore.address,
      ).paymentCredential;

      const custPkh = customerPaymentCredential?.hash!
      const vendPkh = vendorPkh
      setCustomerPkh(custPkh)
      lucid!.utxosAt(scriptAddr).then((contractUtxos: UTxO[]) => {
        console.log(contractUtxos, vendPkh)
        getSubscriptionData(lucid, vendPkh, custPkh, contractUtxos)
          .then((data) => {
            console.log("data", data)
            setSubscriptionData(data)
            if (data.isSubscribed) { setSubscriptionStart(data.subscribedUntil) }
          }).catch((err) => {
            setDisplayMessage({title:"Error", message:err.message})
            setShowModal(true)
          })
      })

    } else if (walletStore.name) {
      initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
    }
  }, [lucid, walletStore.address])

  const lockUtxo = async (vendorPkh: string, customerPkh: string) => {
    if (lucid) {
      const funds = calculateTotalPrice(selectedPeriods, price)
      const priceValue = { "lovelace": BigInt(price) }
      const intervalMs = BigInt(intervalDays * 24 * 60 * 60 * 1000)
      const generatedDatum = generateDatum(customerPkh, vendorPkh, funds, priceValue, intervalMs, new Date(subscriptionStart))
      const tx = await lucid.newTx()
        .payToContract(scriptAddress, { inline: generatedDatum }, funds)
        /* .payToContract(scriptAddress, {
          asHash: Data.empty(),
          scriptRef: script, // adding plutusV2 script to output
        }, { lovelace: BigInt(0) }) */
        .complete();
      const signedTx = await tx.sign().complete();
      const txHash = await signedTx.submit()
      setDisplayMessage({title:"Transaction submitted", message:`Tx hash: ${txHash}`})
      setShowModal(true)
      console.log(txHash);
    }

  }


  return (
    <div className="hero min-h-screen bg-base-200">
      <MessageModal message={displayMessage.message} active={showModal} title={displayMessage.title} />
      <div className="hero-content flex-col ">
        <div className="card flex-shrink-0 w-full max-w-lg shadow-2xl bg-base-100">
          <div className="card-body">
            <div className="text-center lg:text-left">
              <h1 className="text-5xl font-bold">Subscribe now!</h1>
              <p className="py-4 break-all max-w-fit">Connect your wallet. If you are already subscribed to this vendor, the &quot;subscription start date&quot; will automatically be set to the end of you current subscription so you can add more time to it.</p>
              <WalletConnect />
              <Link href="/customer">
                <button className="btn btn-primary m-1 p-0 w-40" >My subscriptions</button>
              </Link>
              <h1 className="text-xl font-bold text-accent">{subscriptionData?.isSubscribed ? "You are already subscribed!" : ""}</h1>
              <h1 className="text-2xl font-bold">Vendor Pubkeyhash:</h1>
              <p className="py-4 break-all">{vendorPkh}</p>
              <h1 className="text-2xl font-bold">Period length:</h1>
              <p className="py-4 break-all">{intervalDays} days</p>
              <h1 className="text-2xl font-bold">Price per period:</h1>
              <p className="py-4 break-all">{(price / 1000000).toFixed(4)} ADA</p>
              <h1 className="text-2xl font-bold">Subscription start date:</h1>
              <p className="py-4 break-all">{new Date(subscriptionStart).toDateString()}</p>
              <h1 className="text-2xl font-bold">Periods to pay:</h1>
              <input type="number" placeholder="0" value={selectedPeriods} onChange={(e) => { selectPeriods(parseInt(e.target.value)) }} className="input input-bordered input-primary my-3 w-sm max-w-xs" />
              <p className="py-4 break-all">TOTAL: {totalPrice} ADA</p>

            </div>

            <div className="form-control mt-6">
              <button disabled={disabled} className={`btn btn-primary `} onClick={() => { lockUtxo(vendorPkh, customerPkh) }} >Subscribe</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Subscription