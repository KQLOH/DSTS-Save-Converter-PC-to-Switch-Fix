# DSTS Save Converter - PC ↔ Switch Fix

Experimental fork of the original  
**TyohDev/Digimon-Story-Time-Stranger-Save-Converter**

This project converts save files for **Digimon Story: Time Stranger** between the PC and Nintendo Switch versions.

> ⚠️ **Experimental**
>
> PC → Switch conversion has been successfully tested on a real save, including character loading and movement.
>
> However, save compatibility may still vary depending on game version, DLC, save state, and platform differences.
>
> **Always back up your original PC and Switch saves before using this tool.**

---

## What This Fork Fixes

This fork focuses mainly on improving **PC → Switch** conversion.

### Included fixes

- Fixes invisible / missing player character after conversion
- Fixes player being unable to move after loading
- Handles the known PC/Switch save structure offset difference
- Resets incompatible character model / appearance data where needed
- Preserves the original Switch-compatible save header
- Preserves the original PC playtime instead of replacing it with the playtime from the Switch template
- Uses an existing Switch JKSV backup as the template for PC → Switch conversion

---

## Current Status

### Switch → PC

Expected to work similarly to the original project.

### PC → Switch

Tested successfully with:

- Save loads correctly
- Character is visible
- Character can move normally
- Original PC progress is retained
- PC playtime preservation has been tested successfully on the author's converted save

More testing is still needed with different saves, game versions, DLC combinations, and story states.

---

## How to Use

### PC → Switch

1. Create a normal save on your Nintendo Switch.
2. Export that save using **JKSV**.
3. Keep an untouched backup of both your PC and Switch saves.
4. Launch this converter.
5. Select:

   - **Direction:** PC → Switch
   - **Input Folder:** your original PC save folder
   - **Output Folder:** where you want the converted files
   - **Original Switch Backup ZIP:** your original JKSV Switch backup

6. Click **Convert**.
7. Copy the converted save into an existing JKSV-recognized backup if necessary.
8. Restore the save using JKSV.
9. Launch the game and test the save before saving over anything important.

---

## Switch → PC

1. Export your Switch save using JKSV.
2. Select **Switch → PC** in the converter.
3. Select the Switch save folder.
4. Select an output folder.
5. Click **Convert**.
6. Copy the converted files into the appropriate PC save directory.

---

## Run From Source

You need **Node.js** installed.

Clone the repository:

```bash
git clone https://github.com/KQLOH/DSTS-Save-Converter-PC-to-Switch-Fix.git
