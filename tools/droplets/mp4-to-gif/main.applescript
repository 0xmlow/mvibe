-- MP4 to GIF droplet (max quality): videos -> one GIF each; images -> one unified GIF.
property modeArgs : ""

on run
	try
		set picks to (choose file with prompt "Pick video(s) and/or image(s):" of type {"public.movie", "public.video", "public.image"} with multiple selections allowed)
		my processItems(picks)
	on error number -128
	end try
end run

on open theItems
	my processItems(theItems)
end open

on processItems(theItems)
	set scriptPath to quoted form of (POSIX path of (path to resource "convert.sh"))
	set argStr to ""
	repeat with anItem in theItems
		set p to ""
		try
			set p to POSIX path of (anItem as alias)
		on error
			try
				set p to POSIX path of anItem
			end try
		end try
		if p is not "" then set argStr to argStr & " " & quoted form of p
	end repeat
	
	if argStr is "" then
		display dialog "Nothing to convert." & return & return & "Drop videos and/or images onto the app icon." buttons {"OK"} default button "OK" with title "MP4 → GIF"
		return
	end if
	
	set outText to do shell script scriptPath & modeArgs & argStr
	
	set createdCount to 0
	set errCount to 0
	set firstOut to ""
	repeat with s in (paragraphs of outText)
		set s to s as text
		if s starts with "CREATED=" then
			set tid to AppleScript's text item delimiters
			set AppleScript's text item delimiters to " "
			set w to text items of s
			set AppleScript's text item delimiters to "="
			try
				set createdCount to (text item 2 of (item 1 of w)) as integer
				set errCount to (text item 2 of (item 2 of w)) as integer
			end try
			set AppleScript's text item delimiters to tid
		else if s starts with "OUT:" then
			if firstOut is "" then set firstOut to text 5 thru -1 of s
		end if
	end repeat
	
	if firstOut is not "" then
		try
			do shell script "open -R " & quoted form of firstOut
		end try
	end if
	
	if errCount > 0 then
		set msg to (createdCount as text) & " GIF(s) created, " & (errCount as text) & " failed."
		set b to button returned of (display dialog msg buttons {"Open Log", "OK"} default button "OK" with icon caution with title "MP4 → GIF")
		if b is "Open Log" then
			do shell script "open " & quoted form of ((POSIX path of (path to desktop)) & "mp4-to-gif.log")
		end if
	else if createdCount > 0 then
		try
			display notification (createdCount as text) & " GIF(s) created" with title "MP4 → GIF ✓" sound name "Glass"
		end try
	else
		display dialog "No convertible files found." & return & return & "Drop videos (MP4, MOV, MKV…) and/or images (PNG, JPG, HEIC…)." buttons {"OK"} default button "OK" with title "MP4 → GIF"
	end if
end processItems

