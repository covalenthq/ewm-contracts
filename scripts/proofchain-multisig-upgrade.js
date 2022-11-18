const { ethers } = require('hardhat');
const { defender } = require("hardhat");

const proofChainAddress = process.env.PROOFCHAIN_ADDRESS

async function main() {
    const ProofChainV2 = await ethers.getContractFactory("ProofChain");
    console.log("Preparing proposal...");
    const proposal = await defender.proposeUpgrade(proofChainAddress, ProofChainV2);
    console.log("Upgrade proposal created at:", proposal.url);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });