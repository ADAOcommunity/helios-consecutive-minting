import type { NextPage } from 'next'
import WalletConnect from '../components/WalletConnect'
import { useStoreState } from "../utils/store"
import { useState, useEffect } from 'react'
import { Data, Lucid, SpendingValidator, Tx, TxComplete, UTxO, } from 'lucid-cardano'
import initLucid from '../utils/lucid'
import { generateDatum, generateMintingContractWithParams, generateThreadContract, reconstructDatum, ReconstructedDatum } from '../contracts/contract'
import MessageModal from '../components/MessageModal'
import LoadingModal from '../components/LoadingModal'
import { useRouter } from 'next/router'
import { url } from 'inspector'
import Link from 'next/link';

const MintPage: NextPage = () => {
    const router = useRouter();
    const threadTokenPolicy = router.query["threadTokenPolicy"] as string;
    const threadTokenName = router.query["collectionName"] as string;
    const [contractUrl, setContractUrl] = useState<{ text: string, url: string }>({ text: "", url: "/" })

    const walletStore = useStoreState((state: any) => state.wallet)
    const [lucid, setLucid] = useState<Lucid>()

    const [displayMessage, setDisplayMessage] = useState<{ title: string, message: string }>({ title: "", message: "" })
    const [showModal, setShowModal] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)
    const [nftPolicyId, setNftPolicyId] = useState<string>("")
    const [mintPolicyScript, setMintPolicyScript] = useState<string>()
    const [threadAddress, setThreadAddress] = useState<string>("")
    const [threadScript, setThreadScript] = useState<SpendingValidator>()
    const [priceVal, setPriceVal] = useState<string>("")
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout>()
    const [amountMinted, setAmountMinted] = useState<number>(1)

    useEffect(() => {
        if (walletStore.name != "") {
            initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
        } else {
            setLoading(false)
            setDisplayMessage({ title: "Not connected", message: "Close this modal and connect your wallet." })
            setShowModal(true)
        }
    }, [walletStore.name, walletStore.address])

    useEffect(() => {
        if (lucid && !threadAddress) {
            const threadScript: SpendingValidator = {
                type: "PlutusV2",
                script: JSON.parse(generateThreadContract().serialize()).cborHex,
            };
            const threadAddr = lucid!.utils.validatorToAddress(threadScript)
            setThreadScript(threadScript)
            setThreadAddress(threadAddr)
            findRefUtxo(threadAddr)
            const nftScript: SpendingValidator = {
                type: "PlutusV2",
                script: JSON.parse(generateMintingContractWithParams(threadTokenPolicy, threadTokenName).serialize()).cborHex,
            };
            setMintPolicyScript(nftScript.script)
            setNftPolicyId(lucid!.utils.validatorToScriptHash(nftScript))
            setContractUrl({ text: "See contract code", url: `/contractcode?threadTokenPolicy=${threadTokenPolicy}&collectionName=${threadTokenName}` })
        }
    }, [lucid])
    const findRefUtxo = async (threadAddr: string) => {
        setLoading(true)
        try {
            const threadTokenAssetName = threadTokenPolicy + Buffer.from(threadTokenName).toString("hex")
            const utxos = await lucid!.utxosAtWithUnit(threadAddr, threadTokenAssetName)
            let suitableUtxos: UTxO[] = []
            for (let utxo of utxos) {
                let datum = await lucid!.datumOf(utxo!)
                const reconstructedDatum = reconstructDatum(datum)
                if (reconstructedDatum.maxSupply - reconstructedDatum.count >= amountMinted) {
                    suitableUtxos.push(utxo)
                }
            }
            const randomUtxoIndex = Math.floor(Math.random() * suitableUtxos.length);
            if (suitableUtxos.length > 0 || utxos.length == 0) {
                const utxo = suitableUtxos[randomUtxoIndex]
                let datum = await lucid!.datumOf(utxo!)
                const reconstructedDatum = reconstructDatum(datum)
                clearTimeout(intervalId)
                setPriceVal((Number(reconstructedDatum.price) / 1000000).toFixed(3))
                setLoading(false)
                return { utxo, reconstructedDatum }
            } else {
                clearTimeout(intervalId)
                return { utxo: undefined, reconstructedDatum: undefined }
                /* setDisplayMessage({title:"Not available",message: "There are no UTxOs with that amount available. Please choose a lower amount to mint."})
                setLoading(false)
                setShowModal(true) */
            }

        } catch (err) {
            console.log("Searching UTxO...")
            setIntervalId(setTimeout(() => { findRefUtxo(threadAddr) }, 5000))
        }
    }
    const getMintAssets = (reconstructedDatum: ReconstructedDatum, assetCount: number) => {
        let assets: any = {}
        for (let i = reconstructedDatum.count + 1; i <= reconstructedDatum.count + assetCount; i++) {
            const nftNumber = i
            const nftAssetname = nftPolicyId + Buffer.from(reconstructedDatum.tokenName + nftNumber.toString()).toString("hex")
            assets[nftAssetname] = 1
        }
        return assets
    }
    const mint = async () => {
        setShowModal(false)
        // const amountMinted = 25
        const refUtxo = await findRefUtxo(threadAddress)
        if (refUtxo!.utxo && refUtxo!.reconstructedDatum) {
            const sellerPkh = refUtxo!.reconstructedDatum.sellerPkh;
            const sellerAddress = refUtxo!.reconstructedDatum.sellerAddress;
            const threadTokenAssetName = threadTokenPolicy + Buffer.from(threadTokenName).toString("hex");
            const nftNumber = refUtxo!.reconstructedDatum.count + amountMinted;
            const datum = generateDatum(sellerPkh, sellerAddress, refUtxo!.reconstructedDatum.maxSupply, refUtxo!.reconstructedDatum.tokenName, threadTokenPolicy, nftPolicyId, refUtxo!.reconstructedDatum.price, nftNumber)
            const price = { lovelace: BigInt(refUtxo!.reconstructedDatum.price * amountMinted) }
            const nftAssetname = nftPolicyId + Buffer.from(refUtxo!.reconstructedDatum.tokenName + nftNumber.toString()).toString("hex")
            const assets = getMintAssets(refUtxo!.reconstructedDatum, amountMinted)
            if (lucid) {
                let tx: TxComplete | undefined = undefined
                try {
                    tx = await lucid.newTx()
                        .addSigner(walletStore.address)
                        // .payToContract(seedScriptAddress, Data.empty(), {})
                        .collectFrom([refUtxo!.utxo], Data.empty())
                        .payToContract(threadAddress, { inline: datum }, { [threadTokenAssetName]: BigInt(1) })
                        // .readFrom([refUtxo!])
                        .attachMintingPolicy({ type: "PlutusV2", script: mintPolicyScript! })
                        .attachMintingPolicy(threadScript!)
                        // .mintAssets({ [nftAssetname]: BigInt(3) }, Data.empty())
                        .mintAssets(assets, Data.empty())
                        .attachMetadata(721, {
                            [nftPolicyId]: {
                                [refUtxo!.reconstructedDatum.tokenName + nftNumber.toString()]: {
                                    image: "ipfs://QmNyHUZxfRxGpwg9QSbe3cMDkaT8so17TRvzXpNio5gbGf",
                                    mediaType: "image/png",
                                    name: refUtxo!.reconstructedDatum.tokenName + " #" + nftNumber,
                                    description: "This is a cool NFT minted by a Plutus SC."
                                },
                            },
                        })
                        // .payToAddress(walletStore.address, { [nftAssetname]: BigInt(3) })
                        .payToAddress(walletStore.address, assets)
                        .payToAddress(sellerAddress, price)
                        .complete();

                } catch (err) {
                    console.log(err)
                    //mint()
                }
                if (tx) {
                    try {
                        const signedTx = await tx.sign().complete();
                        const txHash = await signedTx.submit()
                        setDisplayMessage({ title: "Transaction submitted", message: `Tx hash: ${txHash}` })
                        setShowModal(true)
                        console.log(txHash);
                    } catch (err: any) {
                        console.log(err)
                        setDisplayMessage({ title: "Busy UTxO", message: JSON.stringify(err.info) })
                        setShowModal(true)
                    }
                }
            }
        } else {
            setDisplayMessage({ title: "Not available", message: "There are no UTxOs with that amount available. Please choose a lower amount to mint." })
            setLoading(false)
            setShowModal(true)
        }
    }

    return (
        <div className="hero min-h-screen bg-base-200">
            <MessageModal message={displayMessage.message} active={showModal} title={displayMessage.title} />
            <LoadingModal active={loading} />
            <div className="hero-content flex-col ">
                <div className="card flex-shrink-0 w-full max-w-lg shadow-2xl bg-base-100">
                    <div className="card-body">
                        <div className="text-center lg:text-left">
                            <h1 className="text-5xl font-bold">Mint!</h1>
                            {/* <p className="py-4 break-all max-w-fit">Connect your wallet. If you are already subscribed to this vendor, the &quot;subscription start date&quot; will automatically be set to the end of you current subscription so you can add more time to it.</p> */}
                            <WalletConnect />
                            <h1 className="text-2xl font-bold">Policy Id:</h1>
                            <p className="py-4 break-all">{nftPolicyId}</p>
                            <h1 className="text-2xl font-bold">Price:</h1>
                            <p className="py-4 break-all">{priceVal} ADA</p>
                        </div>
                        <input type="number" placeholder="1" value={amountMinted} onChange={(e) => { setShowModal(false); setAmountMinted(parseInt(e.target.value)) }} className="input input-bordered w-full max-w-xs" />
                        <label className="label">
                            <span className="label-text-alt">Max 25.</span>
                        </label>
                        <div className="form-control mt-6">
                            <button className={`btn btn-primary `} onClick={() => { mint() }} >Mint</button>
                        </div>
                        {contractUrl.text && <p><Link href={contractUrl.url}><a className="link link-primary text-xl">{contractUrl.text}</a></Link></p>}

                    </div>
                </div>
            </div>
        </div>
    )
}
export default MintPage
