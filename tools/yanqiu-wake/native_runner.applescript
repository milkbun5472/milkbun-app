use framework "Foundation"
use scripting additions

-- Compiled with rearm.applescript into one dedicated, background-only app.
-- A fresh local request is required; double-clicking cannot replay an old wake.
on run
    set runtimePath to (POSIX path of (path to home folder)) & "Library/Application Support/LisaPhone/yanqiu-wake/"
    set request to current application's NSDictionary's dictionaryWithContentsOfFile:(runtimePath & ".sentinel_native_request.plist")
    if request is missing value then return
    set nonce to (request's objectForKey:"nonce") as text
    if (length of nonce) is not 32 then return
    set requestedAt to (request's objectForKey:"requested_at") as integer
    set currentDate to current application's NSDate's |date|()
    set currentEpoch to (currentDate's timeIntervalSince1970()) as integer
    if currentEpoch < requestedAt or currentEpoch - requestedAt > 30 then return
    set my requestDeadline to requestedAt + 20
    set previous to current application's NSDictionary's dictionaryWithContentsOfFile:(runtimePath & ".sentinel_native_reply.plist")
    if previous is not missing value then
        if ((previous's objectForKey:"nonce") as text) is nonce then return
    end if
    set targetID to (request's objectForKey:"target") as text
    set probeOnly to (((request's objectForKey:"mode") as text) is "probe")
    set outcome to my rearm(targetID, probeOnly)
    set reply to current application's NSDictionary's dictionaryWithObjects:{nonce, outcome} forKeys:{"nonce", "outcome"}
    reply's writeToFile:(runtimePath & ".sentinel_native_reply.plist") atomically:true
end run
