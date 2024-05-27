
require('@openzeppelin/hardhat-upgrades');
require('hardhat-abi-exporter');
require('hardhat-contract-sizer');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async(taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

module.exports = {
    defender: {
        apiKey: process.env.DEFENDER_API_KEY,
        apiSecret: process.env.DEFENDER_SECRET_KEY,
    },
    solidity: {
        version: '0.8.13',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1,
            },
        },
    },
    gasReporter: {
        currency: 'CHF',
        gasPrice: 21,
    },
    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
    mocha: {
        timeout: 100000,
    },
    abiExporter: [{
            path: './generated-abis/ugly',
            clear: true,
            flat: true,
            spacing: 2,
        },
        {
            path: './generated-abis/pretty',
            pretty: true,
        },
    ],
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: true,
        strict: true,
        only: [':ProofChain$'],
    },
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            forking: {
                url: "https://eth-mainnet.public.blastapi.io",
                blockNumber: 13182263
        },
        },
        test: {
            url: 'http://0.0.0.0:8545/',
        },
        // mainnet: {
        //     url: "https://eth-mainnet.public.blastapi.io",
        //     accounts: [
        //         process.env.CONTRACTS_DEPLOYER,
        //         process.env.SC_MANAGER
        //     ],
        // chainId: 1,
        // },
        // moonbeam: {
        //     url: "https://rpc.api.moonbeam.network",
        //     gas: 5000000,
        //     gasPrice: "auto",
        //     accounts: [
        //         process.env.CONTRACTS_DEPLOYER,
        //         process.env.SC_MANAGER
        //     ],
        // chainId: 1284,
        // },
        // sepolia: {
        //     url: "https://ethereum-sepolia.publicnode.com",
        //     accounts: [
        //         process.env.CONTRACTS_DEPLOYER,
        //         process.env.SC_MANAGER,
        //     ],
        // },
        // moonbeamAlpha: {
        //     url: "https://rpc.api.moonbase.moonbeam.network",
        //     gas: 5000000,
        //     gasPrice: "auto",
        //     accounts: [
        //         process.env.CONTRACTS_DEPLOYER,
        //     ],
        //     chainId: 1287,
        // }
    },
    etherscan: {
        apiKey: {
            moonbeam: process.env.MOONBEAM_SCAN_API_KEY, // Moonbeam Moonscan API Key
            moonbaseAlpha: process.env.MOONBEAM_SCAN_API_KEY, // Moonbeam Moonscan API Key
            sepolia: process.env.ETHERSCAN_API_KEY,
            mainnet: process.env.ETHERSCAN_API_KEY
        }
    }
};
