
const optimize = false;
import { Address, Program, PubKeyHash, UplcProgram } from '@hyperionbt/helios'
import { Assets, toHex, C, UTxO, Data, Lucid } from 'lucid-cardano'
import { format } from 'path';
import { getInputsFromPkh } from './cardano';

export interface SubscriptionData {
    utxos: UTxO[]
    refUtxo: UTxO
    refDatum: ReconstructedDatum
    oldestUtxo: UTxOWithDatum
    isSubscribed: boolean
    subscribedUntil: number
    claimablePeriods: number
    claimableAmount: number
    lockedFunds: number
    remainingPeriods: number
}
export interface ReconstructedDatum {
    customer: string
    vendor: string
    funds: Map<any, any>
    price: Map<any, any>
    interval: BigInt
    next_withdrawal: BigInt
}
export interface UTxOWithDatum {
    utxo: UTxO | undefined
    datum: ReconstructedDatum | undefined
}

export interface CustomerData {
    customerPkh: string
    subscriptionData: SubscriptionData
}
export interface ServiceData {
    vendorPkh: string
    subscriptionData: SubscriptionData
}

export const contractScript = `
spending  basic_subscription

// TODO: check staking part as well (as soon as blockfrost fully supports mangled addresses)
struct Datum {
    customer:        PubKeyHash
    vendor:          PubKeyHash
    funds:           Value
    price:           Value              
    interval:        Duration
    next_withdrawal: Time

    func customer_signed(self, tx: Tx) -> Bool {
        tx.is_signed_by(self.customer)
    }

    func sent_to_vendor_correctly(self, tx: Tx) -> Bool {
        tx.value_sent_to(self.vendor) >= self.price   
    }

    func interval_passed(self, tx: Tx) -> Bool {
        tx.now() >= self.next_withdrawal
    }

    func next_datum(self, remaining_funds: Value) -> Datum {
        Datum{
            customer:        self.customer,
            vendor:          self.vendor,
            funds:           remaining_funds,
            price:           self.price,
            interval:        self.interval,
            next_withdrawal: self.next_withdrawal + self.interval
        }
    }
    func remaining_funds_locked_correctly(self, tx: Tx, contract_hash: ValidatorHash) -> Bool {
        remaining: Value = self.funds - self.price;
        tx.value_locked_by_datum(contract_hash, self.next_datum(remaining), true) >= remaining
    }
    // func cancelled_amount_correctly(self, tx: Tx, contract_hash: ValidatorHash) -> Bool {
    //     requested_intervals: Int = (self.funds - tx.value_locked_by_datum(contract_hash, self, true)).get(AssetClass::ADA) / self.price.get(AssetClass::ADA);
    //     expired_intervals: Int = (tx.now() - self.next_withdrawal + self.interval)/self.interval;
    //     remaining_intervals: Int = self.funds.get(AssetClass::ADA) / self.price.get(AssetClass::ADA);
    //     print("expired: "+expired_intervals.show());
    //     print("requested_intervals: "+requested_intervals.show());
    //     print("remaining_intervals: "+remaining_intervals.show());
    //     remaining_intervals - expired_intervals >= requested_intervals
    // }
}
func main(datum: Datum, ctx: ScriptContext) -> Bool {
    tx: Tx = ctx.tx;
    //cancelled_correctly: Bool = datum.cancelled_amount_correctly(tx,  ctx.get_current_validator_hash());
    //TO DO: allow vendor to withdraw multiple intervals at once
    //we count how many utxos with datum we have in input
    datums:Int=tx.inputs.map((x:TxInput)->Int{x.output.datum.switch{None => 0, else => 1}}).fold((sum:Int,x:Int)->Int{sum+x},0);
    // probably no need for double satisfaction protection due to high likelihood that datum is always unique
    (datum.customer_signed(tx)) || (
        contract_hash: ValidatorHash = ctx.get_current_validator_hash();
        datum.sent_to_vendor_correctly(tx) &&
        datums == 1 &&
        datum.interval_passed(tx) &&
        datum.remaining_funds_locked_correctly(tx, contract_hash)
    )
}`;

const datumScript = `
// code to generate a Datum for a new subscription
const CUSTOMER_BYTES = # // must be 28 bytes long
const VENDOR_BYTES   = # // must be 28 bytes long
const FUNDS_LOVELACE = 0
const PRICE_LOVELACE = 0
const INTERVAL_MS    = 0
const NEXT_WDRWL_MS  = 0
const DATUM = Datum{
    customer: PubKeyHash::new(CUSTOMER_BYTES),
    vendor:   PubKeyHash::new(VENDOR_BYTES),
    funds:    Value::lovelace(FUNDS_LOVELACE),
    price:    Value::lovelace(PRICE_LOVELACE),
    interval: Duration::new(INTERVAL_MS),
    next_withdrawal: Time::new(NEXT_WDRWL_MS)
}`;

const src = contractScript + datumScript;

export const getCompiledProgram = (): UplcProgram => {
    //console.log((Address.fromValidatorHash(true, Program.new(contractScript).compile(optimize).validatorHash)).toBech32())
    return Program.new(contractScript).compile(optimize);
}


export const calcScriptAddress = (): Address => {
    return Address.fromValidatorHash(true, Program.new(contractScript).compile(optimize).validatorHash);
}

export const generateDatum = (customerPkh: string, vendorPkh: string, funds: Assets, price: Assets, interval: BigInt, nextWithdrawal: Date): any => {
    const program = Program.new(src);

    if (customerPkh === null) {
        throw new Error("unexpected null customerPkh");
    } else {
        let pkh = PubKeyHash.fromHex(customerPkh)
        program.changeParam("CUSTOMER_BYTES", JSON.stringify(pkh.bytes));
    }


    if (vendorPkh === null) {
        throw new Error("unexpected null vendorPkh");
    } else {
        let vkh = PubKeyHash.fromHex(vendorPkh)
        program.changeParam("VENDOR_BYTES", JSON.stringify(vkh.bytes))
    }

    if (Object.keys(funds).filter((asset) => asset != 'lovelace').length > 0) {
        throw new Error("'funds' doesn't yet support other assets");
    } else {
        program.changeParam("FUNDS_LOVELACE", funds.lovelace.toString());
    }

    if (Object.keys(price).filter((asset) => asset != 'lovelace').length > 0) {
        throw new Error("price doesn't yet support other assets");
    } else {
        program.changeParam("PRICE_LOVELACE", price.lovelace.toString());
    }

    program.changeParam("INTERVAL_MS", interval.toString());

    program.changeParam("NEXT_WDRWL_MS", nextWithdrawal.getTime().toString());

    return toHex(C.encode_json_str_to_plutus_datum(program.evalParam("DATUM").data.toSchemaJson(), 1).to_bytes())
    //return program.evalParam("DATUM").data.toCbor();
}

export const reconstructDatum = (datumCbor: string) => {
    let fields = (Data.from(datumCbor) as any).fields
    console.log(fields)
    let datumJson: ReconstructedDatum = {
        customer: fields[0],
        vendor: fields[1],
        funds: fields[2].get("").get(""),
        price: fields[3].get("").get(""),
        interval: fields[4],
        next_withdrawal: fields[5],
    }
    return datumJson;
}

export const calculateTotalPrice = (periods: number, periodPrice: number): Assets => {
    console.log(BigInt(periodPrice * periods).toString())
    return { "lovelace": BigInt(periodPrice * periods) }
}


export const getSubscriptionData = async (lucid: Lucid, vendorPkh: string, customerPkh: string, contractUtxos: UTxO[]) => {
    const utxos: UTxO[] = []
    let highestNextWithdrawal = 0   //highest value of next_withdrawal in utxos
    let lowestNextWithdrawal = 0   //lowest value of next_withdrawal in utxos
    let subscribedUntil = Date.now() //latest date of subscription, based on the datum with highestNextWithdrawal and the amount locked in that utxo
    let oldestUtxo: UTxOWithDatum = { utxo: undefined, datum: undefined } //utxo with the smallest value of next_withdrawal. It should be used as the one to redeem first
    let isSubscribed = false //true if the current date is inside the next withdrawal interval of at least one of the utxos
    let claimablePeriods = 0
    let claimableAmount = 0
    let lockedFunds = 0
    let totalPeriods = 0

    const refUtxos: UTxO[] = []
    for (let utxo of contractUtxos) {
        if (Boolean(utxo.scriptRef)) {
            let utxoInputs = await getInputsFromPkh(utxo.txHash, vendorPkh)
            if (utxoInputs.length > 0) {
                refUtxos.push(utxo)
            }
        }
    }
    let refDatum = reconstructDatum(await lucid!.datumOf(refUtxos[refUtxos.length - 1]))
    console.log("refDatum", refDatum)
    for (let utxo of contractUtxos) {
        if (!Boolean(utxo.scriptRef)) {
            let datum = reconstructDatum(await lucid!.datumOf(utxo))
            lockedFunds += Number(datum.funds)
            if (datum.customer == customerPkh && datum.vendor === vendorPkh) {
                const utxoTotalPeriods = Number(datum.funds) / Number(refDatum.price)
                console.log(Number(datum.next_withdrawal) >= Date.now(), (Number(datum.next_withdrawal) - Number(refDatum.interval)) <= Date.now())
                if (Number(datum.next_withdrawal) + Number(refDatum.interval) * Number(datum.funds) / Number(refDatum.price) >= Date.now() && //checks if the latest next withdrawal hasn't expired by less than the remaining intervals
                    (Number(datum.next_withdrawal) - Number(refDatum.interval)) <= Date.now() &&
                    Number(utxo.assets.lovelace) >= Number(refDatum.price)) {
                    isSubscribed = true
                }
                if (Date.now() >= Number(datum.next_withdrawal)) {
                    const calculatedClaimablePeriods = (Date.now() - Number(datum.next_withdrawal) + Number(datum.interval)) / Number(datum.interval)
                    const utxoClaimablePeriods = Math.round(calculatedClaimablePeriods < utxoTotalPeriods ? calculatedClaimablePeriods : utxoTotalPeriods)
                    const utxoClaimableAmount = utxoClaimablePeriods * Number(refDatum.price)
                    totalPeriods += utxoTotalPeriods
                    claimablePeriods += utxoClaimablePeriods
                    claimableAmount += utxoClaimableAmount
                }
                if (Number(datum.next_withdrawal) > highestNextWithdrawal) {
                    highestNextWithdrawal = Number(datum.next_withdrawal)
                    subscribedUntil = highestNextWithdrawal - Number(refDatum.interval) + Number(refDatum.interval) * Number(datum.funds) / Number(refDatum.price)
                    console.log("until", highestNextWithdrawal, Number(refDatum.interval), Number(datum.funds), Number(refDatum.price))
                }
                if ((Number(datum.next_withdrawal) < lowestNextWithdrawal) || lowestNextWithdrawal === 0) {
                    lowestNextWithdrawal = Number(datum.next_withdrawal)
                    oldestUtxo = { utxo, datum }
                    console.log("oldest", oldestUtxo)
                }
                utxos.push(utxo)
            }
        }
    }
    let remainingPeriods = totalPeriods - claimablePeriods
    if (isSubscribed) remainingPeriods += 1
    return ({ utxos, refUtxo: refUtxos[0], refDatum, oldestUtxo, isSubscribed, subscribedUntil, claimablePeriods, claimableAmount, lockedFunds, remainingPeriods }) //add claimablePeriods + claimableAmount
}

export const getVendorSubscriptions = async (lucid: Lucid, vendorAddress: string, contractUtxos: UTxO[]) => {
    const vendorPkh = lucid.utils.getAddressDetails(
        vendorAddress,
    ).paymentCredential?.hash!
    const clientPubkeys: string[] = []
    const customerList: CustomerData[] = []
    for (let utxo of contractUtxos) {
        if (!Boolean(utxo.scriptRef)) {
            let datum = reconstructDatum(await lucid!.datumOf(utxo))
            console.log(!Boolean(utxo.scriptRef))
            if (datum.vendor === vendorPkh && !clientPubkeys.includes(datum.customer)) {
                let subscriptionData = await getSubscriptionData(lucid, vendorPkh, datum.customer, contractUtxos)
                console.log(datum)
                clientPubkeys.push(datum.customer)
                customerList.push({ customerPkh: datum.customer, subscriptionData })
            }
        }
    }
    return customerList
}

export const getCustomerSubscriptions = async (lucid: Lucid, customerAddress: string, contractUtxos: UTxO[]) => {
    const customerPkh = lucid.utils.getAddressDetails(
        customerAddress,
    ).paymentCredential?.hash!
    const vendorPubkeys: string[] = []
    const vendorList: ServiceData[] = []

    for (let utxo of contractUtxos) {
        if (!Boolean(utxo.scriptRef)) {
            let datum = reconstructDatum(await lucid!.datumOf(utxo))
            console.log(!Boolean(utxo.scriptRef))
            if (datum.customer === customerPkh && !vendorPubkeys.includes(datum.vendor)) {
                let subscriptionData = await getSubscriptionData(lucid, datum.vendor, customerPkh, contractUtxos)
                console.log(subscriptionData)
                if (subscriptionData.isSubscribed) {
                    vendorPubkeys.push(datum.vendor)
                    vendorList.push({ vendorPkh: datum.vendor, subscriptionData })
                }
            }
        }
    }
    return vendorList
}