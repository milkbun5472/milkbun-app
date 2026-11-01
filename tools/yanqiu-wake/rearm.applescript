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

on sendSnapshot(targetID)
    set currentSnapshot to my snapshotFor(targetID)
    repeat 10 times
        if ((currentSnapshot's objectForKey:"status") as text) is not "ready" then exit repeat
        if (currentSnapshot's objectForKey:"send") is not missing value then exit repeat
        if my requestExpired() then exit repeat
        delay 0.2
        set currentSnapshot to my snapshotFor(targetID)
    end repeat
    return currentSnapshot
end sendSnapshot

on permissionProbe(targetID)
    try
        with timeout of 3 seconds
            set s to my snapshotFor(targetID)
            if (s's objectForKey:"composer") is missing value then return (s's objectForKey:"status") as text
            set composer to my resolveControl(s, "composer")
            tell application "System Events"
                if role of composer is "AXTextArea" then return "permission_ready"
            end tell
        end timeout
    end try
    return "ui_unavailable"
end permissionProbe

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
            -- AXValue updates before React has rendered/enabled Send. In a
            -- restarted backend this takes longer than a normal idle window.
            set currentSnapshot to my sendSnapshot(targetID)
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

on remoteState(snapshot)
    if (snapshot's objectForKey:"remote_toggle") is missing value then return "remote_unknown"
    if ((snapshot's objectForKey:"remote_on") as boolean) then return "remote_on"
    return "remote_off"
end remoteState

on remoteAction(currentState, toggleEnabled, probeOnly)
    if currentState is not "remote_off" then return currentState
    if probeOnly then return "remote_off"
    if not toggleEnabled then return "remote_unavailable"
    return "enable"
end remoteAction

on passiveRemoteProbe(targetID)
    try
        set s to my snapshotFor(targetID)
        if (s's objectForKey:"page") is missing value then return (s's objectForKey:"status") as text
        -- Do not open a panel while Lisa is using Claude in the foreground.
        if ((s's objectForKey:"foreground") as boolean) and (s's objectForKey:"remote_toggle") is missing value then return "remote_hidden"
        return my restoreRemote(targetID, true)
    end try
    return "remote_unknown"
end passiveRemoteProbe

on closeOpenedDetails(targetID, openedDetails)
    if not openedDetails then return
    try
        with timeout of 3 seconds
            set s to my snapshotFor(targetID)
            if (s's objectForKey:"details") is missing value then return
            if ((s's objectForKey:"details_open") as boolean) then
                set detailButton to my resolveControl(s, "details")
                tell application "System Events"
                    if value of detailButton is 1 then perform action "AXPress" of detailButton
                end tell
            end if
        end timeout
    end try
end closeOpenedDetails

on restoreRemote(targetID, probeOnly)
    if not (targetID starts with "local_") or (length of targetID) is not 42 then return "wrong_window"
    set openedDetails to false
    try
        with timeout of 3 seconds
            set s to my snapshotFor(targetID)
            if ((s's objectForKey:"status") as text) is "wrong_window" then
                if probeOnly then return "wrong_window"
                open location ("claude://claude.ai/epitaxy/" & targetID)
                repeat 12 times
                    delay 0.3
                    set s to my snapshotFor(targetID)
                    if (s's objectForKey:"page") is not missing value then exit repeat
                end repeat
            end if
            if (s's objectForKey:"page") is missing value then return (s's objectForKey:"status") as text
            if ((s's objectForKey:"status") as text) is "busy" then return "busy"
            if not ((s's objectForKey:"empty") as boolean) then return "draft_present"
            if (s's objectForKey:"remote_toggle") is missing value then
                if (s's objectForKey:"details") is missing value then return "remote_unknown"
                if not ((s's objectForKey:"details_open") as boolean) then
                    set detailButton to my resolveControl(s, "details")
                    tell application "System Events"
                        if value of detailButton is 0 then
                            perform action "AXPress" of detailButton
                            set openedDetails to true
                        end if
                    end tell
                end if
                repeat 8 times
                    delay 0.2
                    set s to my snapshotFor(targetID)
                    if (s's objectForKey:"remote_toggle") is not missing value then exit repeat
                end repeat
            end if
            set outcome to my remoteState(s)
            if outcome is "remote_on" or outcome is "remote_off" then
                set remoteButton to my resolveControl(s, "remote_toggle")
                tell application "System Events"
                    if value of remoteButton is 1 then
                        set outcome to "remote_on"
                    else
                        set outcome to "remote_off"
                    end if
                end tell
            end if
            -- The switch is read before any action. Already-on is a no-op;
            -- /remote-control is never typed because it can toggle off.
            if outcome is "remote_on" or outcome is "remote_off" then
                set outcome to my remoteAction(outcome, (s's objectForKey:"remote_toggle_enabled") as boolean, probeOnly)
            end if
            if outcome is "enable" then
                    set s to my snapshotFor(targetID)
                    if ((s's objectForKey:"status") as text) is "busy" or not ((s's objectForKey:"empty") as boolean) then
                        my closeOpenedDetails(targetID, openedDetails)
                        return "busy"
                    end if
                    if my remoteState(s) is "remote_on" then
                        set outcome to "remote_on"
                    else if my remoteState(s) is "remote_off" and not my requestExpired() then
                        set remoteButton to my resolveControl(s, "remote_toggle")
                        tell application "System Events"
                            if value of remoteButton is 0 and enabled of remoteButton then perform action "AXPress" of remoteButton
                        end tell
                        set outcome to "remote_waiting"
                        repeat 8 times
                            delay 0.3
                            set s to my snapshotFor(targetID)
                            if my remoteState(s) is "remote_on" then
                                set outcome to "remote_restored"
                                exit repeat
                            end if
                        end repeat
                    end if
            end if
            my closeOpenedDetails(targetID, openedDetails)
            return outcome
        end timeout
    on error
        my closeOpenedDetails(targetID, openedDetails)
        return "remote_unknown"
    end try
end restoreRemote
