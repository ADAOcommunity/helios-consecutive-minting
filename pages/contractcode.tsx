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
              let func = line.split("func")
              if (func.length > 1) {
                let funcName = func[1].split("(")[0]
                let argumentPart = func[1].split("(")[1].split(")")[0]
                let funcType = func[1].split("(")[1].split(")")[1].split(" ")[2]
                console.log(argumentPart)
                let funcArgs = argumentPart.split(",")
                console.log(funcArgs)
                return <pre key={index} data-prefix={(index + 1).toString()}>{func[0]}
                  <span className="text-accent" >func </span>
                  <span className="text-neutral">{funcName + "("}</span>
                  {funcArgs.map((funcArg, index) => {
                    return <><span>{(index > 0 ? ", " : "")}</span><span className="text-primary">{funcArg.split(":")[0].replace(" ", "") + (funcArg.split(":").length > 1 ? ": " : "")}</span><span className="text-warning">{funcArg.split(":")[1]?.replace(" ", "")}</span></>
                  })}
                  <span>{") -> "}</span>
                  <span className="text-warning">{funcType}</span><span>{" {"}</span>
                </pre>
              } else {
                let declareVarLine = line.split("=")
                let declareVar = declareVarLine[0].replace(" ", "")
                if (declareVarLine.length > 1 && !line.includes("const")) {
                  return <pre key={index} data-prefix={(index + 1).toString()}>
                    <span className="text-primary">{declareVar.split(":")[0]}: </span>
                    <span className="text-warning">{declareVar.split(":")[1]?.replace(" ", "")} = </span>
                    <span className="text-primary">{declareVarLine[1]}</span>
                  </pre>
                } else {
                  return <pre key={index} data-prefix={(index + 1).toString()}>{line}</pre>
                }
              }
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
              let func = line.split("func")
              if (func.length > 1) {
                let funcName = func[1].split("(")[0]
                let argumentPart = func[1].split("(")[1].split(")")[0]
                let funcType = func[1].split("(")[1].split(")")[1].split(" ")[2]
                console.log(argumentPart)
                let funcArgs = argumentPart.split(",")
                console.log(funcArgs)
                return <pre key={index} data-prefix={(index + 1).toString()}>{func[0]}
                  <span className="text-accent" >func </span>
                  <span className="text-neutral">{funcName + "("}</span>
                  {funcArgs.map((funcArg, index) => {
                    return <><span>{(index > 0 ? ", " : "")}</span><span className="text-primary">{funcArg.split(":")[0].replace(" ", "") + (funcArg.split(":").length > 1 ? ": " : "")}</span><span className="text-warning">{funcArg.split(":")[1]?.replace(" ", "")}</span></>
                  })}
                  <span>{") -> "}</span>
                  <span className="text-warning">{funcType}</span><span>{" {"}</span>
                </pre>
              } else {
                let declareVarLine = line.split("=")
                let declareVar = declareVarLine[0].replace(" ", "")
                if (declareVarLine.length > 1) {
                  return <pre key={index} data-prefix={(index + 1).toString()}>
                    <span className="text-primary">{declareVar.split(":")[0]}: </span>
                    <span className="text-warning">{declareVar.split(":")[1]?.replace(" ", "")} = </span>
                    <span className="text-primary">{declareVarLine[1].replace(";", "")}</span><span className="text-secondary">;</span>
                  </pre>
                } else {
                  return <pre key={index} data-prefix={(index + 1).toString()}>{line}</pre>
                }
              }
            })}
          </div>
          {/* <div className="mockup-code bg-primary-content text-neutral">
            {threadContractArray.map((line: string, index: number) => {
              let spacing = line.split(" ")//.filter((char)=>char=="")
              let leadingSpaces = 0
              for (let i = 0; i < spacing.length; i++) {
                leadingSpaces++
                if (spacing[i] != "") {
                  break
                }
              }
              return <pre key={index} data-prefix={(index + 1).toString()}>{line}</pre>
            })}
          </div> */}
        </div>
      </div>
    </>

  )
}
export default ContractCodePage
