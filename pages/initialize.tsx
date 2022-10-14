import type { NextPage } from 'next'
import Head from 'next/head'
import WalletConnect from '../components/WalletConnect'
import { useStoreActions, useStoreState } from "../utils/store"
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Data, Lucid, SpendingValidator } from 'lucid-cardano'
import initLucid from '../utils/lucid'
import { generateContract } from '../contracts/seedingContract'
import { generateMintingContractWithParams, generateDatum, generateThreadContract } from '../contracts/contract'

import MessageModal from '../components/MessageModal'
import LoadingModal from '../components/LoadingModal'

const Initialize: NextPage = () => {
    const walletStore = useStoreState((state: any) => state.wallet)
    const [lucid, setLucid] = useState<Lucid>()
    const [seedScript, setSeedScript] = useState<SpendingValidator>()
    const [displayMessage, setDisplayMessage] = useState<{ title: string, message: string }>({ title: "", message: "" })
    const [showModal, setShowModal] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)
    const [threadToken, setThreadToken] = useState<string>("")
    const [datum, setDatum] = useState({})
    const [mintUrl, setMintUrl] = useState<{text:string, url: string}>({text:"", url: "/"})
    //minting params
    const [nftName, setNftName] = useState<string>("")
    const [maxSupply, setMaxSupply] = useState<number>(0)
    const [price, setPrice] = useState<number>(0)
    const verifTokenName = "thread"

    useEffect(() => {
        if (!lucid) {
            if (walletStore.name != "") {
                setLoading(true)
                initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
            } else {
                setLoading(false)
                setDisplayMessage({ title: "Not connected", message: "Close this modal and connect your wallet." })
                setShowModal(true)
            }
        } else {
            setLoading(true)
            const sellerPkh = lucid!.utils.getAddressDetails(
                walletStore.address,
            ).paymentCredential!.hash;
            const thisScript: SpendingValidator = {
                type: "PlutusV2",
                script: JSON.parse(generateContract(sellerPkh).serialize()).cborHex,
            };
            setSeedScript(thisScript)
            let policyId = lucid.utils.validatorToScriptHash(thisScript)
            setThreadToken(policyId + Buffer.from(verifTokenName).toString("hex"))
            setLoading(false)
        }
    }, [lucid, walletStore.name, walletStore.address])

    const createScripts = (seedPolicyId: string) => {
        const mintScript: SpendingValidator = {
            type: "PlutusV2",
            script: JSON.parse(generateMintingContractWithParams(seedPolicyId).serialize()).cborHex,
        };
        const mintScriptAddr = lucid!.utils.validatorToAddress(mintScript)
        const threadScript: SpendingValidator = {
            type: "PlutusV2",
            script: JSON.parse(generateThreadContract().serialize()).cborHex,
        };
        const threadScriptAddr = lucid!.utils.validatorToAddress(threadScript)
        return({mintScript: mintScript, mintAddress: mintScriptAddr, threadScript:threadScript, threadAddress: threadScriptAddr})
    }
    const mintSeedNft = async () => {
        const sellerPkh = lucid!.utils.getAddressDetails(
            walletStore.address,
        ).paymentCredential!.hash;
        const threadPolicyId = lucid!.utils.validatorToScriptHash(seedScript!)
        const mintingScriptData = createScripts(threadPolicyId)
        const nftPolicyId = lucid!.utils.validatorToScriptHash(mintingScriptData.mintScript!)
        console.log(sellerPkh, maxSupply, nftName, threadPolicyId, nftPolicyId,  price*1000000, 0)
        let datum = generateDatum(sellerPkh,walletStore.address, maxSupply, nftName, threadPolicyId, nftPolicyId,  price*1000000, 0)
        if (lucid) {
            const tx = await lucid.newTx()
                .addSigner(walletStore.address)
                // .payToContract(seedScriptAddress, Data.empty(), {})
                .mintAssets({ [threadToken]: BigInt(1) }, Data.empty())
                .payToContract(mintingScriptData.threadAddress, {inline: datum}, { [threadToken]: BigInt(1) })
                .attachMintingPolicy(seedScript!)
                .complete({nativeUplc:false});
            const signedTx = await tx.sign().complete();
            const txHash = await signedTx.submit()
            setDisplayMessage({ title: "Transaction submitted", message: `Tx hash: ${txHash}` })
            setShowModal(true)
            setMintUrl({text:"Go to mint page", url:`/mint?threadTokenPolicy=${threadPolicyId}`})
            console.log(txHash);
        }
    }

    return (

        <div className="hero min-h-screen bg-base-200">
            <MessageModal message={displayMessage.message} active={showModal} title={displayMessage.title} link={mintUrl}/>
            <LoadingModal active={loading} />
            <div className="hero-content flex-col ">
                <div className="card flex-shrink-0 w-full max-w-lg shadow-2xl bg-base-100">
                    <div className="card-body">
                        <div className="text-center lg:text-left">
                            <h1 className="text-5xl font-bold">Subscribe now!</h1>
                            <p className="py-4 break-all max-w-fit">Connect your wallet. If you are already subscribed to this vendor, the &quot;subscription start date&quot; will automatically be set to the end of you current subscription so you can add more time to it.</p>
                            <WalletConnect />
                            <h1 className="text-2xl font-bold">Your Address:</h1>
                            <p className="py-4 break-all">{walletStore.address}</p>
                            <h1 className="text-2xl font-bold">Mint Parameters:</h1>
                            <div className="form-control w-full max-w-xs">
                                <label className="label">
                                    <span className="label-text">Token name</span>
                                    <span className="label-text-alt">e.g.: SpaceBudz</span>
                                </label>
                                <input type="text" placeholder="Enter token name" value={nftName} onChange={(e) => {setNftName(e.target.value)}}  className="input input-bordered w-full max-w-xs" />
                                {/* <label className="label">
                                    <span className="label-text-alt">Alt label</span>
                                    <span className="label-text-alt">Alt label</span>
                                </label> */}
                                <label className="label mt-5">
                                    <span className="label-text">Price</span>
                                    <span className="label-text-alt">Price per NFT</span>
                                </label>
                                <label className="input-group">
                                    <input type="number" placeholder="0" value={price} onChange={(e) => { setPrice(parseInt(e.target.value)) }} className="input input-bordered" />
                                    <span>ADA</span>
                                </label>

                                <label className="label mt-5">
                                    <span className="label-text">Max Supply</span>
                                </label>
                                <input type="number" placeholder="0" value={maxSupply} onChange={(e) => { setMaxSupply(parseInt(e.target.value)) }}  className="input input-bordered w-full max-w-xs" />
                            </div>
                            <h1 className="text-2xl font-bold mt-8">Seed Token:</h1>
                            <p className="py-4 break-all">{threadToken}</p>
                        </div>

                        <div className="form-control mt-6">
                            <button className={`btn btn-primary `} onClick={() => { mintSeedNft(walletStore.address) }} >Create collection</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default Initialize
