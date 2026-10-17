const assert=require('node:assert/strict');
// Live town windows keep ticking. Take the expected rollback at the original API
// boundary, not before an asynchronous browser click and its intervening frames.
module.exports=async(f,method)=>{
 await f.evaluate(method=>{window.petTransactionCheck={method,original:PetGame[method],before:null};PetGame[method]=(...args)=>{const s=PetGame.snapshot();petTransactionCheck.before=s.pets.find(x=>x.id===s.activePetId).town;return petTransactionCheck.original.apply(PetGame,args);};},method);
 return {assertRollback:async()=>{const q=await f.evaluate(()=>{const s=PetGame.snapshot();return {actual:s.pets.find(x=>x.id===s.activePetId).town,before:petTransactionCheck.before};});assert.ok(q.before,'the actual API must have been called');assert.deepEqual(q.actual,q.before);},restore:()=>f.evaluate(()=>{PetGame[petTransactionCheck.method]=petTransactionCheck.original;delete window.petTransactionCheck;})};
};
