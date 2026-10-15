-- RAW + HEIC to PNG droplet: each dropped HEIC/HEIF or camera RAW -> upright, full-res 8-bit PNG next to the source.
on run
	try
		set picks to (choose file with prompt "Pick HEIC or RAW image(s) to convert to PNG:" of type {"public.heic", "public.heif", "public.camera-raw-image", "public.image"} with multiple selections allowed)
		my processItems(picks)
	on error number -128
	end try
end run

on open theItems
	my processItems(theItems)
end open

on processItems(theItems)
	set scriptPath to quoted form of (POSIX path of (path to resource "photo2png.sh"))
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
		display dialog "Nothing to convert." & return & return & "Drop HEIC or RAW images onto the app icon." buttons {"OK"} default button "OK" with title "RAW + HEIC → PNG"
		return
	end if
	
	set outText to do shell script scriptPath & argStr
	
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
		set msg to (createdCount as text) & " PNG(s) created, " & (errCount as text) & " failed."
		set b to button returned of (display dialog msg buttons {"Open Log", "OK"} default button "OK" with icon caution with title "RAW + HEIC → PNG")
		if b is "Open Log" then
			do shell script "open " & quoted form of ((POSIX path of (path to desktop)) & "photo-to-png.log")
		end if
	else if createdCount > 0 then
		try
			display notification (createdCount as text) & " PNG(s) created" with title "RAW + HEIC → PNG ✓" sound name "Glass"
		end try
	else
		display dialog "No HEIC or RAW files found." & return & return & "Drop .heic / .heif or camera RAW (.nef, .cr2, .arw, .dng …) onto the app." buttons {"OK"} default button "OK" with title "RAW + HEIC → PNG"
	end if
end processItems

