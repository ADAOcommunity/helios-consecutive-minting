import type { NextPage } from 'next'
import Head from 'next/head'
import WalletConnect from '../components/WalletConnect'
import { useStoreActions, useStoreState } from "../utils/store"
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { C, Data, Lucid, SpendingValidator, UTxO } from 'lucid-cardano'
import initLucid from '../utils/lucid'
import { generateDatum, generateMintingContractWithParams, generateThreadContract, reconstructDatum, ReconstructedDatum } from '../contracts/contract'
import MessageModal from '../components/MessageModal'
import LoadingModal from '../components/LoadingModal'
import { useRouter } from 'next/router'

const MintPage: NextPage = () => {
    const router = useRouter();
    const threadTokenPolicy = router.query["threadTokenPolicy"] as string;
    const threadTokenName = "thread"

    const walletStore = useStoreState((state: any) => state.wallet)
    const [lucid, setLucid] = useState<Lucid>()

    const [displayMessage, setDisplayMessage] = useState<{ title: string, message: string }>({ title: "", message: "" })
    const [showModal, setShowModal] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)
    const [refUtxo, setRefUtxo] = useState<UTxO>()
    const [nftPolicyId, setNftPolicyId] = useState<string>("")
    const [mintPolicyScript, setMintPolicyScript] = useState<string>()
    const [queriedDatum, setQueriedDatum] = useState<ReconstructedDatum>()
    const [threadAddress, setThreadAddress] = useState<string>("")
    const [threadScript, setThreadScript] = useState<SpendingValidator>()
    const [priceVal, setPriceVal] = useState<string>("")
    

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
            const threadScript: SpendingValidator = {
                type: "PlutusV2",
                script: JSON.parse(generateThreadContract().serialize()).cborHex,
            };
            const threadAddr = lucid.utils.validatorToAddress(threadScript)
            setThreadScript(threadScript)
            setThreadAddress(threadAddr)
            findRefUtxo(threadAddr).then((utxo) => {
                setRefUtxo(utxo)
                console.log(utxo)
                lucid!.datumOf(utxo!).then((datum)=>{
                    const reconstructedDatum = reconstructDatum(datum)
                    setQueriedDatum(reconstructedDatum)
                    setPriceVal((Number(reconstructedDatum.price) /1000000).toFixed(3))
                }).catch((err)=>{
                    setDisplayMessage({title:"Error", message:err.message})
                    setShowModal(true)
                })
            })
            
            const nftScript: SpendingValidator = {
                type: "PlutusV2",
                script: JSON.parse(generateMintingContractWithParams(threadTokenPolicy).serialize()).cborHex,
            };
            console.log(nftScript)
            setMintPolicyScript(nftScript.script)
            setNftPolicyId(lucid.utils.validatorToScriptHash(nftScript))
            setLoading(false)
        }
    }, [lucid, walletStore.name, walletStore.address])

    const findRefUtxo = async (threadAddr: string) => {
        const threadTokenAssetName = threadTokenPolicy + Buffer.from(threadTokenName).toString("hex")
        const utxos = await lucid!.utxosAtWithUnit(threadAddr, threadTokenAssetName)
        const utxo = utxos[utxos.length - 1]
        return utxo
    }
    const mint = async () => {
        const sellerPkh = queriedDatum!.sellerPkh;
        const sellerAddress = queriedDatum!.sellerAddress
        const threadTokenAssetName = threadTokenPolicy + Buffer.from(threadTokenName).toString("hex")
        console.log(queriedDatum)
        console.log(threadTokenPolicy)
        const nftNumber = queriedDatum!.count + 1
        console.log(sellerPkh, queriedDatum!.maxSupply, queriedDatum!.tokenName, threadTokenPolicy, nftPolicyId, queriedDatum!.price, nftNumber)
        const datum = generateDatum(sellerPkh, sellerAddress, queriedDatum!.maxSupply, queriedDatum!.tokenName, threadTokenPolicy, nftPolicyId, queriedDatum!.price, nftNumber)
        const price = { lovelace: BigInt(queriedDatum!.price) }
        const nftAssetname = nftPolicyId + Buffer.from(queriedDatum!.tokenName + nftNumber.toString()).toString("hex")
        console.log(refUtxo)
        if (lucid) {
            const tx = await lucid.newTx()
                .addSigner(walletStore.address)
                // .payToContract(seedScriptAddress, Data.empty(), {})
                .collectFrom([refUtxo!], Data.empty())
                .payToContract(threadAddress, {inline: datum}, { [threadTokenAssetName]: BigInt(1)})
               // .readFrom([refUtxo!])
                .attachMintingPolicy({ type: "PlutusV2", script: mintPolicyScript! })
                .attachMintingPolicy(threadScript!)
                .mintAssets({ [nftAssetname]: BigInt(1) }, Data.empty())
                .attachMetadata(721, {
                    [nftPolicyId]: {
                      [queriedDatum!.tokenName+nftNumber.toString()]: {
                        image:"ipfs://QmNyHUZxfRxGpwg9QSbe3cMDkaT8so17TRvzXpNio5gbGf",
                        mediaType: "image/png",
                        name:queriedDatum!.tokenName +" #"+nftNumber,
                        description:"This is cool NFT minted by a Plutus SC."
                      },
                    },
                  })
                .payToAddress(walletStore.address, { [nftAssetname]: BigInt(1) })
                .payToAddress(sellerAddress, price)
                .complete({nativeUplc:false});
            const signedTx = await tx.sign().complete();
            const txHash = await signedTx.submit()
            setDisplayMessage({ title: "Transaction submitted", message: `Tx hash: ${txHash}` })
            setShowModal(true)
            console.log(txHash);
        }

    }

    return (

        <div className="hero min-h-screen bg-base-200">
            <MessageModal message={displayMessage.message} active={showModal} title={displayMessage.title}  />
            <LoadingModal active={loading} />
            <div className="hero-content flex-col ">
                <div className="card flex-shrink-0 w-full max-w-lg shadow-2xl bg-base-100">
                    <div className="card-body">
                        <div className="text-center lg:text-left">
                            <h1 className="text-5xl font-bold">Subscribe now!</h1>
                            <p className="py-4 break-all max-w-fit">Connect your wallet. If you are already subscribed to this vendor, the &quot;subscription start date&quot; will automatically be set to the end of you current subscription so you can add more time to it.</p>
                            <WalletConnect />
                            <h1 className="text-2xl font-bold">Policy Id:</h1>
                            <p className="py-4 break-all">{nftPolicyId}</p>
                            <h1 className="text-2xl font-bold">Price:</h1>
                            <p className="py-4 break-all">{priceVal} ADA</p>
                        </div>
                        <div className="form-control mt-6">
                            <button className={`btn btn-primary `} onClick={() => { mint() }} >Mint</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default MintPage
