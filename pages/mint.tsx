import type { NextPage } from 'next'
import WalletConnect from '../components/WalletConnect'
import { useStoreState } from "../utils/store"
import { useState, useEffect } from 'react'
import { Data, Lucid, SpendingValidator, Tx, TxComplete, } from 'lucid-cardano'
import initLucid from '../utils/lucid'
import { generateDatum, generateMintingContractWithParams, generateThreadContract, reconstructDatum } from '../contracts/contract'
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
            const randomUtxoIndex = Math.floor(Math.random() * utxos.length);
            const utxo = utxos[randomUtxoIndex]
            clearTimeout(intervalId)
            let datum = await lucid!.datumOf(utxo!)
            const reconstructedDatum = reconstructDatum(datum)
            setPriceVal((Number(reconstructedDatum.price) / 1000000).toFixed(3))
            setLoading(false)
            return { utxo, reconstructedDatum }
        } catch (err) {
            const threadTokenAssetName = threadTokenPolicy + Buffer.from(threadTokenName).toString("hex")
            const utxos = await lucid!.utxosAtWithUnit(threadAddr, threadTokenAssetName)
            console.log("Searching UTxO...")
            setIntervalId(setTimeout(() => { findRefUtxo(threadAddr) }, 5000))
        }
    }
    const mint = async () => {
        setShowModal(false)
        const refUtxo = await findRefUtxo(threadAddress)
        const sellerPkh = refUtxo!.reconstructedDatum.sellerPkh;
        const sellerAddress = refUtxo!.reconstructedDatum.sellerAddress
        const threadTokenAssetName = threadTokenPolicy + Buffer.from(threadTokenName).toString("hex")
        const nftNumber = refUtxo!.reconstructedDatum.count + 1
        const datum = generateDatum(sellerPkh, sellerAddress, refUtxo!.reconstructedDatum.maxSupply, refUtxo!.reconstructedDatum.tokenName, threadTokenPolicy, nftPolicyId, refUtxo!.reconstructedDatum.price, nftNumber)
        const price = { lovelace: BigInt(refUtxo!.reconstructedDatum.price) }
        const nftAssetname = nftPolicyId + Buffer.from(refUtxo!.reconstructedDatum.tokenName + nftNumber.toString()).toString("hex")
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
                    .mintAssets({ [nftAssetname]: BigInt(1) }, Data.empty())
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
                    .payToAddress(walletStore.address, { [nftAssetname]: BigInt(1) })
                    .payToAddress(sellerAddress, price)
                    .complete({ nativeUplc: false });

            } catch (err) {
                mint()
            }
            if (tx) {
                try {
                    const signedTx = await tx.sign().complete();
                    const txHash = await signedTx.submit()
                    setDisplayMessage({ title: "Transaction submitted", message: `Tx hash: ${txHash}` })
                    setShowModal(true)
                    console.log(txHash);
                } catch (err: any) {
                    setDisplayMessage({ title: "Busy UTxO", message: JSON.stringify(err.info) })
                    setShowModal(true)
                }
            }
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
