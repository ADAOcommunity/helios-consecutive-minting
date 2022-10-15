import { useState, useEffect, HTMLProps } from 'react'
// table where the customer can see his active subscriptions
const LoadingModal = (props: any) => {
    //const [active, setActive] = useState<boolean>(false);
    const [value, setValue] = useState(0)
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout>()

    const updateValue = (val: number, active: boolean) => {
        if (active) {
            let newVal: number = val + 0.4
            setValue(newVal % 100)
            setIntervalId(setTimeout(() => { updateValue(newVal, props.active) }, 20))
        } else {
            clearTimeout(intervalId)
            setValue(0)
        }
    }
    useEffect(() => {
        let val = 0;
        updateValue(val, props.active)
    }, [props.active])

    return (
        <>
            <input onChange={()=>{}}  checked={props.active} type="checkbox" id="my-modal-3" className="modal-toggle" />
            <div className="modal">
                <div className="modal-box relative text-center">
                    <div className="radial-progress text-xs " style={{ "--value": value, "--size": "5rem", "--thickness": "2px" } as HTMLProps<number>}>Loading...</div>
                </div>
            </div>
        </>
    )
}

export default LoadingModal;