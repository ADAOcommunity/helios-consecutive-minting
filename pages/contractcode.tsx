import type { NextPage } from 'next'
import { useStoreState } from "../utils/store"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { generateStyledThreadContract, generateStyledMintingContract } from '../contracts/contract';

const ContractCodePage: NextPage = () => {
  const router = useRouter();
  const threadTokenPolicy = router.query["threadTokenPolicy"] as string;
  const threadTokenName = router.query["collectionName"] as string;
  const walletStore = useStoreState((state: any) => state.wallet)
  const [threadContractArray, setThreadContractArray] = useState<string[]>([])
  const [mintingContractArray, setMintingContractArray] = useState<string[]>([])

  useEffect(() => {
    if (threadTokenPolicy) {
      setThreadContractArray(generateStyledThreadContract())
      setMintingContractArray(generateStyledMintingContract(threadTokenPolicy, threadTokenName))
    }
  }, [threadTokenPolicy])

  return (
    <>
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content flex-col ">
          <h1 className="text-5xl font-bold">Minting Contract</h1>
          <div className="mockup-code bg-primary-content text-neutral">
            {mintingContractArray.map((line: string, index: number) => {
              let spacing = line.split(" ")//.filter((char)=>char=="")
              let leadingSpaces = 0
              for (let i = 0; i < spacing.length; i++) {
                leadingSpaces++
                if (spacing[i] != "") {
                  break
                }
              }
              return <pre key={index} data-prefix={(index+1).toString()}>{line}</pre>
            })}
          </div>
        </div>
      </div>

      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content flex-col ">
        <h1 className="text-5xl font-bold">Thread Contract</h1>
          <div className="mockup-code bg-primary-content text-neutral">
            {threadContractArray.map((line: string, index: number) => {
              let spacing = line.split(" ")//.filter((char)=>char=="")
              let leadingSpaces = 0
              for (let i = 0; i < spacing.length; i++) {
                leadingSpaces++
                if (spacing[i] != "") {
                  break
                }
              }
              return <pre key={index} data-prefix={(index+1).toString()}>{line}</pre>
            })}
          </div>
        </div>
      </div>
    </>

  )
}
export default ContractCodePage
