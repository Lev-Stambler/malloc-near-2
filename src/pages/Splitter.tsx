import React, { useEffect, useState} from 'react';
import "../splitter.css";

import { Chain } from '@baf-wallet/interfaces';
import { TokenInfo } from '@baf-wallet/chain-info';
import { Tokens } from '../components/CoinPicker';

import { Notification } from '../components/Notification';
import { SplitterItem } from '../components/SplitterItem';
import { SplitterTopItem } from '../components/SplitterTopItem';

import getConfig, { env, Env } from "../config";
import { transactions } from "near-api-js";
import { MAX_GAS, provider } from "../utils";

const { networkId } = getConfig(env);

// TODO: grab from bafnetwork/assets
const supportedTokens: Tokens = {
	"LEV": {
		name: "Lev's Cool Test Fungible Token",
		description: "Lev's very own test token",
		explorer: "https://explorer.near.org/",
		symbol: "LEV",
		type: "COIN",
		chain: Chain.NEAR,
		decimals: 8,
		status: "active"
	}
}

interface Split {
	amount: number;
	percent: number;
	token: TokenInfo;
}

const defaultToken = supportedTokens["LEV"];

export function Splitter() {
	// after submitting the form, we want to show Notification
	const [showNotification, setShowNotification] = useState(false);
	const [explorerLink, setExplorerLink] = useState("");
	const [splits, setSplits] = useState<Split[]>([]);
	const [inputAmount, setInputAmount] = useState<number>(0);
	const [inputToken, setInputToken] = useState<TokenInfo>(defaultToken);

	const defaultSplitter = `
	{
		"owner": "levtester.testnet",
		"split_sum": 200,
		"splits": [100, 100],
		"nodes": [
			{
				"SimpleTransfer": {
					"recipient": "lev.testnet"
				}
				},
				{
				"SimpleTransfer": {
					"recipient": "lev.testnet"
				}
			}
		]
	}`

	
	useEffect(() => {
		const url = new URL(window.location.href);
		const txHash = url.searchParams.get("transactionHashes");
		if (!txHash) return;
		(async () => {
		const result = await provider.txStatus(txHash, window.accountId);
		console.log(result);
		url.searchParams.delete("transactionHashes");
		let newurl =
			window.location.protocol +
			"//" +
			window.location.host +
			window.location.pathname +
			"?" +
			url.searchParams.toString();
		window.history.pushState({ path: newurl }, "", newurl);

		setExplorerLink(`${getConfig(env).explorerUrl}/transactions/${txHash}`);
		setShowNotification(true);
		})();
	}, []);

	const onPercentChange = (idx: number) => {
		return (percent: number) => {
			const newSplits = Array.from(splits);
			newSplits[idx] = {
				...newSplits[idx],
				amount: inputAmount * (percent / 100),
				percent,
			}
			setSplits(newSplits);
		}
	}


	const onTokenChange = (idx: number) => {
		return (token: TokenInfo) => {
			const newSplits = Array.from(splits);
			newSplits[idx] = {
				...newSplits[idx],
				token
			}
			setSplits(newSplits);
		}
	}

  	return (
		<>
			<div className="splitter-layout">
				<div className="splitter-container">
					<SplitterTopItem
						supportedTokens={supportedTokens}	
						defaultToken={defaultToken}
						onAmountChange={setInputAmount}
						onTokenChange={setInputToken}
					/>
					<div className="splitter-items">
						{splits.map((split: Split, i: number) => (
							<SplitterItem
								supportedTokens={supportedTokens}
								defaultToken={defaultToken}
								amount={split.amount}
								onPercentChange={onPercentChange(i)}
								onTokenChange={onTokenChange(i)}
								key={i}
							/>
						))}
					</div>
					<div className="add-new-splitter-item">
						<span className="material-icons add-new-splitter-item-plus">add</span>
					</div>
				</div>
			</div>
		{showNotification && <Notification explorerLink={explorerLink} />}
		</>
	);
}