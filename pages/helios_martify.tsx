import type { NextPage } from 'next'
import Head from 'next/head'
import WalletConnect from '../components/WalletConnect'
import { useStoreActions, useStoreState } from "../utils/store"
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getAssets } from "../utils/cardano";
import NftGrid from "../components/NftGrid";
import initLucid from '../utils/lucid'
import { Lucid, TxHash, Lovelace, Constr, SpendingValidator, Data, toHex, C, Core } from 'lucid-cardano'
import * as helios from '@hyperionbt/helios'

import { Transaction, BrowserWallet, BlockfrostProvider, resolveDataHash } from '@martifylabs/mesh';


const HeliosMartify: NextPage = () => {
  const walletStore = useStoreState((state: any) => state.wallet)
  const [nftList, setNftList] = useState([])
  const [lucid, setLucid] = useState<Lucid>()
  const [script, setScript] = useState<SpendingValidator>()
  const [scriptAddress, setScriptAddress] = useState("")

  useEffect(() => {

    if (lucid) {
      /* const tranche1Time = Date.now() + 120000
      const tranche2Time = Date.now() + 600000 */
      console.log(lucid.fromTx("84a900828258208658e217a17c5a4e04c1f49ad3ae28ab34d5eca075643aa7862374e5335b21ca008258208658e217a17c5a4e04c1f49ad3ae28ab34d5eca075643aa7862374e5335b21ca01018182583900e1d915c10c840017bd39088a82507b27150a438e89077842214913097f2a7ad145f3ea7f7d83548f0315d84af5117a4c2dcc9d292a3f78da1b0000000253e50671021a0003248d081a0045d1390b5820fd4cb1f80643b5a2f325937b2720224883826e3ffb17f18555f558b164af87440d818258208658e217a17c5a4e04c1f49ad3ae28ab34d5eca075643aa7862374e5335b21ca010e81581ce1d915c10c840017bd39088a82507b27150a438e89077842214913091082583900e1d915c10c840017bd39088a82507b27150a438e89077842214913097f2a7ad145f3ea7f7d83548f0315d84af5117a4c2dcc9d292a3f78da1b0000000253c4efaa111a0004b6d4a40081825820bdf552ecc250337694e658e721a22e1d49c7de62bb85aaa6d601987057e35b1758403a9c341506ece417d77459ae73f13ded226b21d93e536e0cfdb22e944f62638ec867abed3177b18ca8719d8e16579a4bba78df31b96b24689221e3196555fe07049fd87980ff0581840000d8799fff821a0001a92a1a02dea80906815901c35901c0010000323232323232323232323232323232323232323232323232323232323232322223333573460080024931324c464666ae70c080cc074c06cdd4241b50167f1e2c0931199ab9c30213301e3300f0024992623300f23300b004300a00623300833011004498c078dd4241b50167f1e2c09324c60060026ea522011ce1d915c10c840017bd39088a82507b27150a438e8907784221491309000150012322337100046eb4004dd680080a91198031bac300300223375e00200400246ae84c0080048d5d1180380091191998008008018011111999ab9a3574600449408cccd5cd18011aba100324a2466600a00a6ae8801000d2649888cccd5cd180124c4600493125049888cc030c00c00926001235742600400246ae88c0080048d5d1180100091aba23002001235744600400246ae88c0080048d5d1180100091aba2300400122300330033003002235742600400246aae78dd50008009000800919118021b99323333573466e2000d2000233716902d1980100119b820044800c8cc0080080112622323333573466e20009201420022337146600800866e0c00d2014002498cdc599b803370c002900a240c091100375a00246ea4dcc00091b99375c003f5f6")
        .txComplete.to_json())
      const tranche1Time = 1664559931885 + 360002
      const tranche2Time = 1664559931885 + 7200000
      console.log(Date.now())

      console.log(lucid.utils.unixTimeToSlot(Date.now()))
      console.log(lucid.utils.unixTimeToSlot(tranche1Time))
      console.log(lucid.utils.unixTimeToSlot(tranche2Time))


      const { paymentCredential } = lucid.utils.getAddressDetails(
        walletStore.address,
      );
      const pubkey_hash = paymentCredential?.hash!
      console.log(pubkey_hash)
      console.log(tranche1Time)
      const program = helios.Program.new(`
      spending vesting

          
           const PUB_KEY_HASH_BYTES: ByteArray  = #${pubkey_hash}
         

          // the compiler is smart enough to add an empty Datum and empty Redeemer as arguments to the actual main entrypoint function
          func main(ctx: ScriptContext) -> Bool {
              tx: Tx = ctx.tx;  

              print((Time::new(${tranche1Time})).show());
              print(tx.now().show());
              tx.is_signed_by( PubKeyHash::new(PUB_KEY_HASH_BYTES)) && tx.now() < Time::new(${tranche1Time})
          }
  `)

      // program.changeParam("PUB_KEY_HASH_BYTES", `#${paymentCredential?.hash!}`);

      const thisScript: SpendingValidator = {
        type: "PlutusV1",
        script: JSON.parse(
          program
            .compile()
            .serialize(),
        ).cborHex,
      };
      setScript(thisScript)
      setScriptAddress(lucid.utils.validatorToAddress(thisScript))
      console.log(lucid.utils.validatorToAddress(thisScript))
    } else {
      initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
    }
  }, [lucid])

  const lockUtxo = async (lovelace: Lovelace) => {
    // connect to a wallet
    const wallet = await BrowserWallet.enable('nami');

    const tx = new Transaction({ initiator: wallet })
      .sendLovelace(scriptAddress, "5000000",{datum: Data.empty()})
    /*  .sendAssets(
       scriptAddress,
       [
         {
           unit: "lovelace",
           quantity: "2000000",
         },
       ],
       { datum: 'supersecret' }
     ); */
    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

  }
  async function _getAssetUtxo({ scriptAddress2, asset, datum }) {
    const blockfrostProvider = new BlockfrostProvider(
      'preview84Fg7cI0ShCtFl5ZmQaCSEJADLOFGbzh',
      0
    );
    const utxos = await blockfrostProvider.fetchAddressUtxos(
      scriptAddress2,
      asset,
    );
    const dataHash = resolveDataHash(datum);
    let utxo = utxos.find((utxo: any) => {
      return utxo.output.dataHash != dataHash;
    });
    return utxos[0];
  }
  const redeemUtxo = async () => {

    if (lucid) {
      const wallet = await BrowserWallet.enable('nami');

      const Redeemer = () => Data.empty();
      const Datum = () => Data.empty();
      console.log(await lucid.utxosAt(scriptAddress))
      const assetUtxo = await _getAssetUtxo({
        scriptAddress2: scriptAddress,
        asset: 'lovelace',
        datum: 'supersecret',
      });
      console.log(assetUtxo)
      /* const referenceScriptUtxo = (await lucid.utxosAt(scriptAddress)).find(
        (utxo) => Boolean(utxo.scriptRef),
      );
      if (!referenceScriptUtxo) throw new Error("Reference script not found"); */

      /* const utxo = (await lucid.utxosAt(scriptAddress)).find((utxo) =>
        utxo.datum === Datum() && !utxo.scriptRef
      );
      if (!utxo) throw new Error("Spending script utxo not found");
      console.log(Date.now())
      const tx = await lucid
        .newTx()
        .validFrom(1664559931885)
        .readFrom([referenceScriptUtxo]) // spending utxo by reading plutusV2 from reference utxo
        .collectFrom([utxo], Redeemer())
        .addSigner(walletStore.address)
        //https://d2poeju3fazyd8.cloudfront.net/?share=7860030a9fc194f87488ad8273fcadde
        .complete(); */

      const [utxo] = await lucid.utxosAt(scriptAddress);
      const tx = new Transaction({ initiator: wallet })
        .redeemValue(script!.script, assetUtxo, { datum: Datum() })
        .sendValue(walletStore.address, assetUtxo)
        .setRequiredSigners([walletStore.address]);
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx, true); // partial sign is true
      const txHash = await wallet.submitTx(signedTx);
      console.log(txHash)
    }

  }

  return (
    <div className="px-10">
      <div className="navbar bg-base-100">
        <div className="flex-1">
          <Link href="/" className="btn btn-ghost normal-case text-xl">Cardano</Link>
        </div>
        <div className="flex-none">
          <WalletConnect />
        </div>
      </div>
      <div>Address: {walletStore.address}</div>
      <div className='m-10'>
        <p>
          MatchingPubKeyHash Example
          Lock a UTxO with a PubKeyHash
          UTxO can be unlocked by providing the same PubKeyHash in the redeemer
          Showcasing Helios; Link: https://github.com/Hyperion-BT/Helios
        </p>

      </div>
      <div className="mx-40 my-10">
        <button className="btn btn-primary m-5" onClick={() => { lockUtxo(BigInt(2000000)) }} >Deposit</button>
        <button className="btn btn-secondary m-5" onClick={() => { redeemUtxo() }}>Unlock</button>
      </div>
    </div>
  )
}

export default HeliosMartify
