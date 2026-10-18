# Teach Your Language

A class app for GEAP 103. Each language pack teaches everyday phrases in one language, made by someone who knows the language. You can practise with flashcards and a quiz.

**Open the app:** https://brettrey.github.io/geap-103-language-app/

## Make your own pack

Your pack teaches your language to someone who doesn't know it. You choose the situations, the phrases and the notes. You're the expert.

### 1. Get the template

On the app's home page, choose **Download the template**. You get one file, `pack.md`.

Make a folder called `language-pack` and put `pack.md` in it. Keep the folder in your GEAP 103 portfolio (Task 7). If you don't have a portfolio yet, keep it in your GEAP103 course folder.

### 2. Write your first situation with your agent

Choose a situation you know well, like ordering food, taking the bus or meeting a friend's family. Write 4 phrases for it.

Your agent can help. Copy this:

> Help me make a language pack for the GEAP 103 class app. Read the instructions at https://github.com/BrettRey/geap-103-language-app and open pack.md in my language-pack folder.
> Ask me which language I'm teaching, who the pack is for, and one situation. Then ask me for 4 phrases, one at a time, with their meanings in English.
> Don't write phrases in my language for me, and don't change them. You can suggest better English for my meanings and notes, but show me each change and let me decide.
> When we finish, show me the whole file.

Then check the file yourself. Is every phrase exactly what you said?

### 3. Check it in the app

Open the app. Under **Try my pack**, choose **Choose my pack folder** and pick your `language-pack` folder. You can also choose **Choose files instead** and select `pack.md` and your recordings together.

The app shows your pack and a list of things to fix. Your files stay on your computer. Your browser may say "upload", but the page only reads the files. Nothing is sent anywhere.

Fix the problems, save the file, and choose your folder again. Then try the flashcards and the quiz.

### 4. Add recordings (if you want to)

Record yourself saying each phrase, for example with your phone's voice recorder. Give each file a short name, like `thank-you.m4a`, and put it in your `language-pack` folder. Under the phrase, write `audio: thank-you.m4a`.

Without a recording, the app uses the computer's voice, if the computer has one for your language.

### 5. Keep going

Add more situations. Ask a classmate to try your pack and tell you what isn't clear (Task 25). Write a Decision Log note when you make an important choice.

## How a pack file works

```
# The name of your language            <- the title

language: the name of your language
language code: es                      <- a short code, like es for Spanish
made by: your first name or a nickname
for: who will use this pack

## At a restaurant                     <- a situation

phrase: the phrase, written in your language
meaning: what it means, in English
say it: how to say it, in English letters, with CAPITALS for the strong part
note: when to use it, who to say it to, or a cultural rule
audio: the-file-name.m4a
```

- Every phrase starts with `phrase:` and needs a `meaning:`. The other lines are optional.
- A situation starts with `##`. Write 4 or more phrases for each one.
- Lines that start with `>` are instructions. The app ignores them.
- A long note can continue on the next line. Don't leave an empty line in the middle.
- Never write your student number or your full name.

The English (Canada) pack in `packs/english-canada/pack.md` is a full example.

## Working in a group

You can work alone or in a group of up to 3. A group can share one pack: each person writes their own situations and adds `made by:` with their name under their situation's `##` line. Or each person makes their own pack, and the group tests each other's.

To share a pack, use a private group repository, the same way as in Task 11. Use pull requests to suggest changes to each other's situations.

## Put your pack in the class app (optional)

The class app is public. If you'd like your pack in it, ask Brett first. Before you do:

- use only your first name or a nickname,
- remember that anyone can listen to your recordings,
- check every phrase one more time.

Brett will help you send it as a pull request.

## Help make the app better

The app is small on purpose, so you can help build it. Some ideas:

- record a phrase in the browser,
- show hard phrases more often,
- add a picture to a phrase,
- a quiz where you type the answer.

Talk to Brett if you'd like to build one.

## For Brett: adding a pack to the class app

1. Merge the pull request. Each pack has its own folder in `packs/`, with `pack.md` and any recordings. Folder names use lower-case letters, numbers and hyphens.
2. Add the folder name to `packs/list.txt`, one per line.
3. Open the pack in the app and read **Check this pack** at the bottom of its page.

The app is four files (`index.html`, `app.js`, `parser.js`, `style.css`) with no build step. GitHub Pages serves it from `main`. Pack text is always shown as plain text, never as HTML.
