import { Lucid, Blockfrost, utf8ToHex, C } from "lucid-cardano";
import { useState, useEffect } from 'react';
import { useStoreActions, useStoreState } from "../utils/store";
import initLucid from "../utils/lucid";

const WalletConnect = () => {
    // const [availableWallets, setAvailableWallets] = useState<string[]>([])
    const walletStore = useStoreState(state => state.wallet)
    const setWallet = useStoreActions(actions => actions.setWallet)
    const availableWallets = useStoreState(state => state.availableWallets)
    const setAvailableWallets = useStoreActions(actions => actions.setAvailableWallets)

    const [connectedAddress, setConnectedAddress] = useState("")

    const loadWalletSession = async () => {
        if (walletStore.connected &&
            walletStore.name &&
            window.cardano &&
            (await window.cardano[walletStore.name.toLowerCase()].enable())
        ) {
            walletConnected(walletStore.name)
        }
    }

    const walletConnected = async (wallet: string, connect: boolean = true) => {
        const addr = connect ? await (await initLucid(wallet)).wallet.address() : ''
        const walletStoreObj = connect ? { connected: true, name: wallet, address: addr } : { connected: false, name: '', address: '' }
        setConnectedAddress(addr)
        setWallet(walletStoreObj)
    }

    const selectWallet = async (wallet: string) => {
        if (
            window.cardano &&
            (await window.cardano[wallet.toLocaleLowerCase()].enable())
        ) {
            walletConnected(wallet)
        }
    }

    useEffect(() => {
        let wallets = []
        if (window.cardano) {
            if (window.cardano.nami) wallets.push('Nami')
            if (window.cardano.eternl) wallets.push('Eternl')
            if (window.cardano.flint) wallets.push('Flint')
            loadWalletSession()
        }
        setAvailableWallets(wallets)
    }, [])

    return (
        <>
            <div className="tooltip text-ellipsis" data-tip={connectedAddress.slice(0,8)+"..."+connectedAddress.slice(connectedAddress.length-4,connectedAddress.length)}>
                <div className="dropdown dropdown-start z-50">
                    <label tabIndex={0} className="btn m-1 bg-neutral">{connectedAddress != "" ? 'Connected' : 'Connect'}</label>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-300 rounded-box w-52 z-50">
                        {availableWallets.map((wallet) =>
                            <li key={wallet} onClick={() => { selectWallet(wallet) }} ><a>{wallet}</a></li>
                        )}
                    </ul>
                </div>
            </div>

        </>
    )
}

export default WalletConnect;