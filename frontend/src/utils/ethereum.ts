import { BrowserProvider, JsonRpcSigner, Contract } from 'ethers';
import CopyrightRegistryABI from '../contracts/CopyrightRegistry.json';
import ContentLicensingABI from '../contracts/ContentLicensing.json';

export const REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const LICENSING_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const connectWallet = async (): Promise<{ provider: BrowserProvider, signer: JsonRpcSigner, address: string } | null> => {
  if (typeof window.ethereum === 'undefined') {
    alert('MetaMask is not installed. Please install it to use this app.');
    return null;
  }

  try {
    const provider = new BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    return { provider, signer, address };
  } catch (error) {
    console.error('User rejected connection', error);
    return null;
  }
};

export const getRegistryContract = (signerOrProvider: JsonRpcSigner | BrowserProvider) => {
  return new Contract(REGISTRY_ADDRESS, CopyrightRegistryABI.abi, signerOrProvider);
};

export const getLicensingContract = (signerOrProvider: JsonRpcSigner | BrowserProvider) => {
  return new Contract(LICENSING_ADDRESS, ContentLicensingABI.abi, signerOrProvider);
};
