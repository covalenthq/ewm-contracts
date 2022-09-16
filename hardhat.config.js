require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require('hardhat-abi-exporter');
require('solidity-coverage');
require('hardhat-contract-sizer');
require("@openzeppelin/hardhat-defender");


module.exports = {
    solidity: {
        version: '0.8.13',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000000,
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
        timeout: 20000,
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
        strict: true
      },
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            chainId: 1,
            forking: {
                url: "http://you.rpc.url.here",
                blockNumber: 13182263,
            },
        },
        test: {
            url: 'http://127.0.0.1:8545/',
        },
        moonbeam: {
            url: process.env.MOONBEAM_NODE,
            accounts : [process.env.MOONBEAM_ACCOUNT_1]
        }
    },
    defender: {
        apiKey: process.env.DEFENDER_API_KEY,
        apiSecret: process.env.DEFENDER_SECRET_KEY,
    },

};