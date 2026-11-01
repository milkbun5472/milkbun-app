-- AppleScript performs all input/click actions. The read-only bridge converts
-- CFURL page addresses and returns scoped integer paths, never message text.
property requestDeadline : 0

on requestExpired()
    set currentDate to current application's NSDate's |date|()
    return ((currentDate's timeIntervalSince1970()) as integer) > my requestDeadline
end requestExpired

on trimmed(valueText)
    return ((current application's NSString's stringWithString:valueText)'s stringByTrimmingCharactersInSet:(current application's NSCharacterSet's whitespaceAndNewlineCharacterSet())) as text
end trimmed

on snapshotFor(targetID)
    if my requestExpired() then error number -1712
    set bridgePath to (POSIX path of (path to me)) & "Contents/MacOS/ax-page"
    set payload to do shell script (quoted form of bridgePath & " " & quoted form of targetID)
    set payloadData to (current application's NSString's stringWithString:payload)'s dataUsingEncoding:(current application's NSUTF8StringEncoding)
    return current application's NSJSONSerialization's JSONObjectWithData:payloadData options:0 |error|:(missing value)
end snapshotFor

on resolveControl(snapshot, keyName)
    set windowIndex to (snapshot's objectForKey:"window") as integer
    set controlPath to (snapshot's objectForKey:keyName) as list
    tell application "System Events"
        tell process "Claude"
            set controlRef to window windowIndex
            repeat with part in controlPath
                set controlRef to UI element (part as integer) of controlRef
            end repeat
            return controlRef
        end tell
    end tell
end resolveControl

on clearOwnNotice(targetID, notice)
    try
        with timeout of 3 seconds
            set currentSnapshot to my snapshotFor(targetID)
            if ((currentSnapshot's objectForKey:"status") as text) is not "ready" then return
            set composer to my resolveControl(currentSnapshot, "composer")
            tell application "System Events"
                if my trimmed(value of composer as text) is notice then set value of composer to ""
            end tell
        end timeout
    end try
end clearOwnNotice

on rearm(targetID, probeOnly)
    if not (targetID starts with "local_") or (length of targetID) is not 42 then return "wrong_window"
    set notice to "[复活守护自动叫醒] 原窗口的叫醒哨兵已离岗超过五分钟。这是本机守护发出的维护通知。请在这个原会话重新挂回一次性哨兵，再继续你自己的活动。"
    set noticeFilled to false
    try
        with timeout of 3 seconds
            set currentSnapshot to my snapshotFor(targetID)
            set currentStatus to (currentSnapshot's objectForKey:"status") as text
            if currentStatus is "wrong_window" and not probeOnly then
                open location ("claude://claude.ai/epitaxy/" & targetID)
                repeat 12 times
                    delay 0.4
                    set currentSnapshot to my snapshotFor(targetID)
                    set currentStatus to (currentSnapshot's objectForKey:"status") as text
                    if currentStatus is not "wrong_window" then exit repeat
                end repeat
            end if
            if currentStatus is not "ready" then return currentStatus
            if not ((currentSnapshot's objectForKey:"empty") as boolean) then return "draft_present"
            set composer to my resolveControl(currentSnapshot, "composer")
            tell application "System Events"
                if my trimmed(value of composer as text) is not "" then return "draft_present"
            end tell
            if probeOnly then return "ready"
            -- Recheck identity and draft immediately before filling.
            set currentSnapshot to my snapshotFor(targetID)
            if ((currentSnapshot's objectForKey:"status") as text) is not "ready" then return "busy"
            set composer to my resolveControl(currentSnapshot, "composer")
            tell application "System Events"
                if my trimmed(value of composer as text) is not "" then return "draft_present"
                if my requestExpired() then return "ui_unavailable"
                set value of composer to notice
                set noticeFilled to true
            end tell
            set currentSnapshot to my snapshotFor(targetID)
            if ((currentSnapshot's objectForKey:"status") as text) is not "ready" then
                my clearOwnNotice(targetID, notice)
                return "busy"
            end if
            set composer to my resolveControl(currentSnapshot, "composer")
            if (currentSnapshot's objectForKey:"send") is missing value or my requestExpired() then
                my clearOwnNotice(targetID, notice)
                return "ui_unavailable"
            end if
            set sendButton to my resolveControl(currentSnapshot, "send")
            tell application "System Events"
                if my trimmed(value of composer as text) is not notice then return "draft_present"
                perform action "AXPress" of sendButton
            end tell
            return "sent"
        end timeout
    on error
        if noticeFilled then my clearOwnNotice(targetID, notice)
        return "ui_unavailable"
    end try
end rearm
