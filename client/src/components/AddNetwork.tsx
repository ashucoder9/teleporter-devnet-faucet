import { addNetwork, addAsset } from "./Metamask"

export default function AddNetwork(props: any) {
    return (
        <div className='footer-buttons'>
            <button className="add-network" onClick={() => {addNetwork(props.config)}}>
                <img alt='metamask' style={{width: "25px", height: "25px", marginRight: "5px"}} src="/memtamask.webp"/>
                Add Network to Your Wallet
            </button>

            {
                props?.token?.CONTRACTADDRESS
                &&
                <button className="add-network" onClick={() => {addAsset(props?.token)}}>
                    <img alt='asset' style={{width: "25px", height: "25px", marginRight: "5px", borderRadius: "25px"}} src={props?.token?.IMAGE}/>
                    Add Asset to Metamask
                </button>
            }
        </div>
    )
}