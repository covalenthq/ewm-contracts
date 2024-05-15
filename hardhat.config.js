require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require('hardhat-abi-exporter');
require('solidity-coverage');
require('hardhat-contract-sizer');
require("@openzeppelin/hardhat-defender");
require("@nomiclabs/hardhat-etherscan");

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
        },
        mainnet: {	
            url: "https://eth-mainnet.public.blastapi.io",
            accounts: [
                process.env.CONTRACTS_DEPLOYER,
                process.env.SC_MANAGER
            ],
        chainId: 1,
        },
        moonbeam: {
            url: "https://rpc.api.moonbeam.network",
            gas: 5000000,
            gasPrice: "auto",
            accounts: [
                process.env.CONTRACTS_DEPLOYER,
                process.env.SC_MANAGER
            ],
        chainId: 1284,
        },
        sepolia: {
            url: "https://ethereum-sepolia.publicnode.com",
            accounts: [
                process.env.CONTRACTS_DEPLOYER,
                process.env.SC_MANAGER,
            ],
        },
        moonbeamAlpha: {
            url: "https://rpc.api.moonbase.moonbeam.network",
            gas: 5000000,
            gasPrice: "auto",
            accounts: [
                process.env.CONTRACTS_DEPLOYER,
            ],
            chainId: 1287,
        }
    },
    etherscan: {
        apiKey: {
            moonbeam: process.env.MOONBEAM_SCAN_API_KEY, // Moonbeam Moonscan API Key
            moonbaseAlpha: process.env.MOONBEAM_SCAN_API_KEY, // Moonbeam Moonscan API Key
            sepolia: process.env.ETHERSCAN_API_KEY,mainnet: process.env.ETHERSCAN_API_KEY
        }
    }
};
