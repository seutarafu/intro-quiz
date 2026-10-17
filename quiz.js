
"use strict";

// ===================================
// 1. 問題データ
// ===================================

let questions = [];

// ===================================
// 2. 画面の部品
// ===================================

const audio = document.getElementById("audio");
const questionNumber = document.getElementById("question-number");
const scoreDisplay = document.getElementById("score");
const message = document.getElementById("message");
const hint = document.getElementById("hint");
const playButton = document.getElementById("play-button");
const playInfo = document.getElementById("play-info");
const choicesBox = document.getElementById("choices");
const feedback = document.getElementById("feedback");
const nextButton = document.getElementById("next-button");

// ===================================
// 3. クイズの状態
// ===================================

let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let playTimer = null;
let playToken = 0;

// 配列の順番をランダムにする
function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
function makeChoices(question) {
  const otherSongs = shuffle(
    questions.filter(song => song.title !== question.title)
  ).slice(0, 3);

  return shuffle([
    question.title,
    ...otherSongs.map(song => song.title)
  ]);
}
  return result;
}

// ===================================
// 4. 問題を表示する
// ===================================

function showQuestion() {
  stopAudio();

  answered = false;

  const question = quizQuestions[currentIndex];

  questionNumber.textContent =
    `第 ${currentIndex + 1} 問 / 全 ${quizQuestions.length} 問`;

  scoreDisplay.textContent = `正解数：${score}`;

  message.textContent = "この曲は何？";
  hint.textContent = "イントロを聴いて選択肢を選ぼう！";
  feedback.textContent = "";
  playInfo.textContent = "再生ボタンを押してください";

  playButton.disabled = false;
  playButton.textContent = "▶ イントロを再生";
  nextButton.hidden = true;

  choicesBox.replaceChildren();

  // 選択肢の順番もランダムにする
  const shuffledChoices = makeChoices(question);
  shuffledChoices.forEach((choice) => {
    const button = document.createElement("button");

    button.className = "choice-button";
    button.textContent = choice;

    button.addEventListener("click", () => {
      checkAnswer(choice, button);
    });

    choicesBox.appendChild(button);
  });

  audio.src = question.file;
  audio.load();
}

// ===================================
// 5. イントロを再生する
// ===================================

async function playIntro() {
  if (answered) return;

  const question = quizQuestions[currentIndex];

  // 前の再生処理を無効にする
  stopAudio();
  const token = playToken;

  playButton.disabled = true;
  playInfo.textContent = "音声を読み込み中…";

  try {
    // 音源を読み込み、長さを確認する
    if (audio.readyState < 1) {
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error("音源を読み込めません"));
        };

        function cleanup() {
          audio.removeEventListener("loadedmetadata", onLoaded);
          audio.removeEventListener("error", onError);
        }

        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("error", onError);

        // 読み込み直前にイベントを登録する
        audio.load();

        if (audio.readyState >= 1) {
          cleanup();
          resolve();
        }
      });
    }

    if (token !== playToken || answered) return;

    if (
      !Number.isFinite(audio.duration) ||
      question.startSeconds < 0 ||
      question.durationSeconds <= 0 ||
      question.startSeconds >= audio.duration
    ) {
      throw new Error("再生位置や再生秒数を確認してください");
    }

    // 指定位置へ移動
    audio.currentTime = question.startSeconds;

    // 指定位置への移動が終わるまで待つ
    if (Math.abs(audio.currentTime - question.startSeconds) > 0.05) {
      await new Promise((resolve, reject) => {
        const onSeeked = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error("再生位置を変更できません"));
        };

        function cleanup() {
          audio.removeEventListener("seeked", onSeeked);
          audio.removeEventListener("error", onError);
        }

        audio.addEventListener("seeked", onSeeked);
        audio.addEventListener("error", onError);

        if (token !== playToken || answered) {
          cleanup();
          resolve();
        }
      });
    }

    if (token !== playToken || answered) return;

    // 指定秒数だけ再生
    await audio.play();

    if (token !== playToken || answered) {
      audio.pause();
      return;
    }

    playInfo.textContent =
      `${question.durationSeconds} 秒間のイントロを再生中…`;

    playTimer = setTimeout(() => {
      if (token !== playToken) return;

      audio.pause();
      playButton.disabled = false;
      playButton.textContent = "↻ もう一度聴く";
      playInfo.textContent = "再生終了！ 回答を選んでください";
    }, question.durationSeconds * 1000);

  } catch (error) {
    if (token !== playToken) return;

    console.error(error);

    playButton.disabled = false;
    playInfo.textContent =
      "再生できませんでした。音源の場所や形式を確認してください。";
  }
}

// ===================================
// 6. 音声を停止する
// ===================================

function stopAudio() {
  playToken++;

  if (playTimer !== null) {
    clearTimeout(playTimer);
    playTimer = null;
  }

  audio.pause();

  // 以前の再生位置は、次の問題の表示時に更新する
}

// ===================================
// 7. 回答を判定する
// ===================================

function checkAnswer(choice, selectedButton) {
  if (answered) return;

  answered = true;
  stopAudio();

  const question = quizQuestions[currentIndex];
  const isCorrect = choice === question.title;

  if (isCorrect) {
    score++;
    message.textContent = "正解！";
    feedback.textContent = `正解は「${question.title}」！`;
  } else {
    message.textContent = "残念、不正解！";
    feedback.textContent = `正解は「${question.title}」でした。`;
  }

  hint.textContent = "回答が終わりました。次へ進もう！";
  scoreDisplay.textContent = `正解数：${score}`;

  // 選択肢を押せなくする
  const buttons = choicesBox.querySelectorAll("button");

  buttons.forEach((button) => {
    button.disabled = true;

    if (button.textContent === question.title) {
      button.classList.add("correct");
    }
  });

  if (!isCorrect) {
    selectedButton.classList.add("wrong");
  }

  playButton.disabled = true;

  nextButton.textContent =
    currentIndex === quizQuestions.length - 1
      ? "結果を見る →"
      : "次の問題へ →";

  nextButton.hidden = false;
}

// ===================================
// 8. 次の問題・結果画面
// ===================================

function nextQuestion() {

  if (currentIndex < quizQuestions.length - 1) {
    currentIndex++;
    showQuestion();
  } else {
   
    showResult();
  }
}
function showResult() {
  
　stopAudio();

  questionNumber.textContent = "クイズ終了";
  scoreDisplay.textContent =
    `正解数：${score} / ${quizQuestions.length}`;

  message.textContent = "お疲れさま！";

  const percentage = Math.round(
    (score / quizQuestions.length) * 100
  );

  hint.textContent = `正解率：${percentage}%`;
  feedback.textContent =
    `${quizQuestions.length} 問中 ${score} 問正解！`;

  playButton.hidden = true;
  playInfo.textContent = "";
  choicesBox.replaceChildren();

  nextButton.textContent = "もう一度遊ぶ";
  nextButton.hidden = false;
}

// ===================================
// 9. イベント登録・開始
// ===================================

playButton.addEventListener("click", playIntro);

nextButton.addEventListener("click", () => {
  if (nextButton.textContent.includes("もう一度遊ぶ")) {
    startQuiz();
  } else {
    nextQuestion();
  }
});
function startQuiz() {
  stopAudio();

  currentIndex = 0;
  score = 0;
  answered = false;

  quizQuestions = shuffle(questions);

  playButton.hidden = false;
  showQuestion();
}

async function loadQuestions() {
  playButton.disabled = true;
  message.textContent = "曲データを読み込み中…";

  try {
    const response = await fetch("songs.json");

    if (!response.ok) {
      throw new Error("songs.json を読み込めません");
    }

    questions = await response.json();

    if (!Array.isArray(questions) || questions.length < 4) {
      throw new Error("曲を4曲以上登録してください");
    }

    for (const song of questions) {
      if (
        !song.title ||
        !song.file ||
        !Number.isFinite(song.startSeconds) ||
        !Number.isFinite(song.durationSeconds) ||
        song.startSeconds < 0 ||
        song.durationSeconds <= 0
      ) {
        throw new Error("曲データの設定を確認してください");
      }
    }

    const titles = questions.map(song => song.title);

    if (new Set(titles).size !== titles.length) {
      throw new Error("曲名が重複しています");
    }

    startQuiz();

 } catch (error) {
  console.error(error);
  message.textContent = "読み込みエラー：" + error.message;
  hint.textContent =
    "songs.json の名前、形式、曲数、ファイル名を確認してください。";
  playButton.disabled = true;
}
}

loadQuestions();
