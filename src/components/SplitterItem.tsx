import React, { useRef, useState } from 'react';

import ContentEditable from 'react-contenteditable';
import { CoinPicker, Tokens } from './CoinPicker';
import { TokenInfo } from '@baf-wallet/chain-info';

export interface SplitterItemProps {
	supportedTokens: Tokens;
	defaultToken: TokenInfo;
	amount: number;
	onPercentChange: (percent: number) => void;
	onTokenChange: (token: TokenInfo) => void;
}

export function SplitterItem(props: SplitterItemProps) {
	const percentRef = useRef('0.0');

	const onPercentChange = (event: any) => {
		const newStr = event.target.value;
		const amount = parseFloat(newStr);

		// don't update the value if it changed
		if (isNaN(amount)) {
			return;
		}

		const rounded = Math.round(amount * 100) / 100;
		percentRef.current = rounded.toFixed(1);
		props.onPercentChange(rounded);
	}

	return (
		<div className="splitter-item">
			<span>{props.amount}</span>
			<ContentEditable
				html={percentRef.current}
				onChange={onPercentChange}
			/>
			<CoinPicker
				onChange={props.onTokenChange}
				defaultToken={props.defaultToken}
				supportedTokens={props.supportedTokens}
			/>
		</div>
	)
}