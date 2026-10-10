// Public page navigation used by existing scene acceptance checks.
async function openLife(page) {
  if (!await page.locator('[data-wk=cdayinteraction]').isVisible()) await page.locator('[data-wk=cdaylifeopen]').click();
  await page.locator('[data-wk=cdayvisitactivity]').waitFor();
}
async function closeLife(page) {
  if (await page.locator('[data-wk=cdayinteraction]').isVisible()) await page.locator('[data-wk=cdayinteraction]').getByRole('button',{name:'回到小世界',exact:true}).click();
}
async function activity(page,value) { await openLife(page); await page.locator('[data-wk=cdayvisitactivity]').selectOption(value); }
async function activityValue(page) { await openLife(page); const value=await page.locator('[data-wk=cdayvisitactivity]').inputValue(); await closeLife(page); return value; }
async function lifeAction(page,kind) { await openLife(page); await page.locator('[data-wk=cdayinteraction] [data-action='+kind+']').click(); }
async function openMore(page) {
  if (!await page.locator('[data-wk=cdaymore]').isVisible()) await page.locator('[data-wk=cdaymoreopen]').click();
}
async function closeMore(page) {
  if (await page.locator('[data-wk=cdaymore]').isVisible()) await page.locator('[data-wk=cdaymore]').getByRole('button',{name:'回到小世界',exact:true}).click();
}
async function moreItem(page,hook) { await openMore(page); await page.locator('[data-wk=cdaymore] [data-wk='+hook+']').click(); }
async function cameraView(page,wide) { await openMore(page); await page.locator('[data-wk=cdaymore]').getByRole('button',{name:wide?'看全景':'跟着TA',exact:true}).click(); }
module.exports={cameraView,openLife,closeLife,activity,activityValue,lifeAction,openMore,closeMore,moreItem};
