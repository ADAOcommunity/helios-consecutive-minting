import type { NextPage } from 'next'
import Head from 'next/head'
import WalletConnect from '../components/WalletConnect'
import { useStoreActions, useStoreState } from "../utils/store"
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getAssets } from "../utils/cardano";
import NftGrid from "../components/NftGrid";
import initLucid from '../utils/lucid'
import { Lucid, TxHash, Lovelace, Constr, SpendingValidator, Data } from 'lucid-cardano'
import * as helios from '../utils/helios'


const Helios: NextPage = () => {
  const walletStore = useStoreState((state: any) => state.wallet)
  const [nftList, setNftList] = useState([])
  const [lucid, setLucid] = useState<Lucid>()
  const [script, setScript] = useState<SpendingValidator>()
  const [scriptAddress, setScriptAddress] = useState("")

  useEffect(() => {
    if (lucid) {
      const tranche1Time = 1664731610800 + 120000
      const tranche2Time = 1664760424352 + 12000000

      const { paymentCredential } = lucid.utils.getAddressDetails(
        walletStore.address
      );

      const pubkey_hash = paymentCredential?.hash!
      const thisScript: SpendingValidator = {
        type: "PlutusV1",
        script: JSON.parse(
          helios.Program.new(`
          spending vesting
          struct VestingTranche {
            time:  Time // 'amount' is available after 'time'
            amount: Value

            func available_from(self, time: Time) -> Value {
                if (time >= self.time) {
                    self.amount
                } else {
                    Value::ZERO
                }
            }

            func remaining_from(self, time: Time) -> Value {
                self.amount - self.available_from(time)
            }
        }

        struct VestingParams {
            tranche1: VestingTranche
            tranche2: VestingTranche
            owner:    PubKeyHash
            func remaining_from(self, time: Time) -> Value {
                self.tranche1.remaining_from(time) + self.tranche2.remaining_from(time)
            }
        }

         const PUB_KEY_HASH_BYTES: ByteArray  = #${pubkey_hash}
        
        const PARAMS: VestingParams = VestingParams {
            tranche1: VestingTranche {
              time: Time::new(${tranche1Time}),
              amount: Value::lovelace(1000000)
            },
            tranche2: VestingTranche {
              time: Time::new(${tranche2Time}),
              amount: Value::lovelace(1000000)
            },
            owner: PubKeyHash::new(PUB_KEY_HASH_BYTES)
        }


        // the compiler is smart enough to add an empty Datum and empty Redeemer as arguments to the actual main entrypoint function
        func main(ctx: ScriptContext) -> Bool {
            tx: Tx = ctx.tx;
            now: Time = tx.now();
           print("sent to owner "+tx.value_sent_to(PARAMS.owner).get(AssetClass::ADA).show());
           print("testing "+ctx.get_current_input().output.value.get(AssetClass::ADA).show());
           remaining_actual: Value = tx.value_locked_by(ctx.get_current_validator_hash());
           print("Sent to contract: "+remaining_actual.get(AssetClass::ADA).show());
            remaining_expected: Value = PARAMS.remaining_from(now);
           // print("test ada "+ Value::lovelace(17000000).get(AssetClass::ADA).show() );
           // tx.outputs_sent_to(PARAMS.owner).get(0).value.get(AssetClass::ADA) < 19000000
            remaining_actual >= remaining_expected && !tx.is_signed_by(PARAMS.owner)
        }
      `)
      //check if  tx.value_locked_by(ctx.get_current_validator_hash()) + datum.total_vested >= (datum.total_vested - sum of values of valid tranche times) ---> make sure that only one output
      .compile().serialize(),
        ).cborHex,
      };
      setScript(thisScript)
      setScriptAddress(lucid.utils.validatorToAddress(thisScript))
    } else {
      initLucid(walletStore.name).then((Lucid: Lucid) => { setLucid(Lucid) })
    }
  }, [lucid])

  const lockUtxo = async (lovelace: Lovelace) => {
    if (lucid) {
      const { paymentCredential } = lucid.utils.getAddressDetails(
        await lucid.wallet.address(),
      );

      console.log(lucid.utils.unixTimeToSlot(Date.now()))
        console.log(scriptAddress)
      // This represents the Datum struct from the Helios on-chain code
      const datum = Data.to(
        new Constr(0, [new Constr(0, [paymentCredential?.hash!])]),
      );
      let token ="cf85feeae10e8f6d36d265e2310045a4afc38319a779232e5dfff2466e65774c50  "
      const tx = await lucid.newTx().payToContract(scriptAddress, datum, {
        lovelace,
      })
     // .payToAddress(walletStore.address,{ lovelace: BigInt(1000000), [token]: BigInt(5) } )
        .complete();
      const signedTx = await tx.sign().complete();
      console.log(await signedTx.submit());
    }

  }

  const redeemUtxo = async () => {
    if (lucid) {
      const { paymentCredential } = lucid.utils.getAddressDetails(
        await lucid.wallet.address(),
      );
      console.log(script!)

      // This represents the Redeemer struct from the Helios on-chain code
      const redeemer = Data.to(
        new Constr(0, [new Constr(0, [paymentCredential?.hash!])]),
      );
        console.log(script)
      const utxo = await lucid.utxosAt(scriptAddress);
      console.log(await lucid.utxosAt(scriptAddress))
      const tx = await lucid.newTx().collectFrom(utxo, Data.empty())
        .addSigner(walletStore.address)
        .validFrom(Date.now() - 10000)
        .validTo(Date.now() + 160000)
        .payToContract(scriptAddress, Data.empty(), {
          lovelace:BigInt(5000000),
        }) .payToContract(scriptAddress, Data.empty(), {
          lovelace:BigInt(5000000),
        })
        .attachSpendingValidator(script as SpendingValidator)
        .complete({ nativeUplc: false });

      console.log(tx.txComplete.to_json())
      const signedTx = await tx.sign().complete();
      console.log(await signedTx.submit());
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
        <button className="btn btn-primary m-5" onClick={() => { lockUtxo(BigInt(15000000)) }} >Deposit</button>
        <button className="btn btn-secondary m-5" onClick={() => { redeemUtxo() }}>Unlock</button>
      </div>
    </div>
  )
}

export default Helios