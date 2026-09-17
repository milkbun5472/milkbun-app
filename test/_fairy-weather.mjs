import {weather} from '../apps/fairy-garden/world.mjs';
export const rainyEpoch=Array.from({length:1000},(_,i)=>'weather-fixture-'+i).find(seed=>weather(1,seed)==='晴日'&&weather(2,seed)==='细雨'&&weather(3,seed)==='晴日');
if(!rainyEpoch)throw Error('No rainy fixture seed');
