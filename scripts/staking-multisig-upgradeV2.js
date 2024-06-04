const { ethers, defender } = require('hardhat');

const stakingAddress = process.env.STAKING_ADDRESS

async function main() {
    const OperationalStakingV2 = await ethers.getContractFactory("OperationalStaking");

    console.log("Preparing proposal...");

    const proposal = await defender.proposeUpgradeWithApproval(stakingAddress, OperationalStakingV2);

    console.log("Upgrade proposed with URL:", proposal.url);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
