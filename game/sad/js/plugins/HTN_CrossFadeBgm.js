"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// --------------------------------------------------------------------------
//
// CrossFadeBgm
//
// Copyright (c) 2016 hatonekoe
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php
//
// 2016/09/13 ver0.2.0 配布jsにbabelをかまし、Internet Explorerでも動作するように
// 2016/09/12 ver0.1.2 コメントの追加や、ログ出力のコメントアウトなど
// 2016/09/11 ver0.1.1 無名BGMを再生するとクラッシュする不具合に対応、first release
// 2016/09/11 ver0.1.0 クロスフェード機能、ひとまずの完成
// 2016/09/10 ver0.0.1 開発開始
//
// --------------------------------------------------------------------------
/*:
 * @plugindesc BGMをクロスフェード
 * @author ハトネコエ - http://hato-neko.x0.com
 *
 * @help
 *
 * プラグインコマンド:
 *   CrossFadeBgm set bgm_name       # 次に流す曲を指定します
 *   CrossFadeBgm set bgm_name,60    # カンマで区切ると次に流す曲、音量などの指定が可能です。カンマのあとにスペースを入れてはいけません
 *   CrossFadeBgm start              # クロスフェードを開始します
 *   CrossFadeBgm setDuration 8.41   # フェード時間を定義します（この例では8.41秒）
 *   CrossFadeBgm resetDuration      # フェード時間をデフォルト値に戻します
 *
 * 【setコマンドの詳細】
 *   CrossFadeBgm set bgm_name,volume,pan,pitch  # setコマンドでは 4つのオプションが指定できます
 *
 *   <options>
 *   bgm_name: BGM名です。空白を含んではいけません。空白文字や日本語を含むファイル名を使うのは避けましょう
 *   volume: 音量です。0 ~ 100、ツクールの「BGMの演奏」のデフォルトだと 90
 *   pan: 音が左右のどちらに寄っているかです。-100 ~ 100、中心は 0 です
 *   pitch: 音の高さです。スピードも変わってしまうようです。50 ~ 200 程度にしましょう。デフォルトは 100
 *
 *   <example>
 *   CrossFadeBgm set Ship1,90,0,100 # 例えばこのように指定できます。カンマのあとにスペースを入れてはいけません
 *   CrossFadeBgm set Ship1,,,100    # 途中の値を省略することが可能です。しかし、BGM名と音量は最低限指定した方がいいです
 *                                   # 省略された音量などの値は、現在流れてるBGMの値が使われます
 *
 * 注意事項:
 *   ツクールでの「デプロイメント」でゲームを出力するとき、「未使用ファイルを含まない」のチェックをONにした場合、
 *   ツクールはプラグインコマンドでどのBGMが使われてるのかまでは見ませんので、
 *   本当は使っているのに、使ってないとみなされて必要なBGMファイルが出力されない場合があります。
 *
 *   これではそのBGMを再生しようとしたときにエラーが発生してしまいます。
 *
 *   対策としては、「未使用ファイルを含まない」のチェックをOFFでデプロイメントするか、
 *   ダミーの（ゲームでは実際通らない）マップを用意して、出力されないBGMを演奏するイベントをそこに置くといいかと思います。
 *
 * @param Default Fade Duration Sec
 * @desc デフォルトのフェード時間（秒）
 * @default 1.20
 *
 */

(function () {
  "use strict";

  var pluginName = "HTN_CrossFadeBgm";

  /**
   * bgm は Array クラス
   * buffer は WebAudio クラス、もしくは Html5Audio クラス
   */

  var BgmBuffer = function () {
    function BgmBuffer() {
      _classCallCheck(this, BgmBuffer);

      BgmBuffer.extendAudioManager();
      BgmBuffer.setIndexForCurrentBgm(0);
    }

    /**
     * ツクールの AudioManager クラスを拡張
     *
     * @FIXME 他のプラグインが playBgm() とか拡張するとこのプラグインが動かなくなる
     */


    _createClass(BgmBuffer, null, [{
      key: "extendAudioManager",
      value: function extendAudioManager() {
        AudioManager._bgmArray = [];
        AudioManager._bgmBufferArray = [];

        /** BGM の再生 */
        AudioManager.playBgm = function (bgm, pos) {
          if (AudioManager.isCurrentBgm(bgm)) {
            AudioManager.updateBgmParameters(bgm);
          } else {
            AudioManager.stopBgm();
            if (bgm.name !== null) {
              if (Decrypter.hasEncryptedAudio && AudioManager.shouldUseHtml5Audio()) {
                AudioManager.playEncryptedBgm(bgm, pos);
              } else {
                bgm.pos = pos;
                BgmBuffer.pushBuffer(bgm);
                // AudioManager._bgmBuffer = AudioManager.createBuffer('bgm', bgm.name);
                AudioManager.updateBgmParameters(bgm);
                if (!AudioManager._meBuffer) {
                  // AudioManager._bgmBuffer.play(true, pos || 0);
                  BgmBuffer.playAllBuffers();
                }
              }
            }
          }
          // AudioManager.updateCurrentBgm(bgm, pos);
        };

        /** playEncryptedBgm から呼ばれる。暗号化されたBGMを再生するためのバッファを作成 */
        AudioManager.createDecryptBuffer = function (url, bgm, pos) {
          AudioManager._blobUrl = url;
          bgm.pos = pos;
          BgmBuffer.pushBuffer(bgm);
          // AudioManager._bgmBuffer = AudioManager.createBuffer('bgm', bgm.name);
          AudioManager.updateBgmParameters(bgm);
          if (!AudioManager._meBuffer) {
            // AudioManager._bgmBuffer.play(true, pos || 0);
            BgmBuffer.playAllBuffers();
          }
          // AudioManager.updateCurrentBgm(bgm, pos);
        };

        /**
         * BGM の再生停止
         * バッファー配列は空にする
         */
        AudioManager.stopBgm = function () {
          AudioManager._bgmBufferArray.forEach(function (buffer) {
            if (buffer !== null) {
              buffer.stop();
              buffer = null;
            }
          });
          BgmBuffer.setIndexForCurrentBgm(0);
          AudioManager._bgmArray = [];
          AudioManager._bgmBufferArray = [];
        };
      }

      /**
       * _bgmBuffer は AudioManager._bgmBufferArray から読み取る
       * _currentBgm は AudioManager._bgmArray から読み取る
       * ここでは、その _bgmBuffer, _currentBgm の書き込み・読み込みの対象となる配列のindex(0~)を指定する
       *
       * @param _indexForCurrentBgm: Number _bgmBuffer, _currentBgm の対象となる配列のindex(0~)
       */

    }, {
      key: "setIndexForCurrentBgm",
      value: function setIndexForCurrentBgm(_indexForCurrentBgm) {
        var indexForCurrentBgm = parseInt(_indexForCurrentBgm);
        var length = BgmBuffer.countBuffers();

        if (indexForCurrentBgm === 0 || 0 <= indexForCurrentBgm && indexForCurrentBgm < length) {
          Object.defineProperty(AudioManager, '_bgmBuffer', {
            get: function get() {
              return AudioManager._bgmBufferArray[indexForCurrentBgm];
            },
            set: function set(_buffer) {
              AudioManager._bgmBufferArray[indexForCurrentBgm] = _buffer;
            },
            configurable: true
          });

          Object.defineProperty(AudioManager, '_currentBgm', {
            get: function get() {
              return AudioManager._bgmArray[indexForCurrentBgm];
            },
            set: function set(_bgm) {
              AudioManager._bgmArray[indexForCurrentBgm] = _bgm;
            },
            configurable: true
          });
        } else {
          console.warn("!!WARN!! index number is not valid @ setIndexForCurrentBgm");
        }
      }

      /**
       * バッファーを後ろに足す
       *
       * @param _newBgm: Array 例 {name: "bgm_title", volume: 90, pitch: 100, pan: 0, pos: 0}
       */

    }, {
      key: "pushBuffer",
      value: function pushBuffer(_newBgm) {
        // 未定義の部分は現在の曲の値をセットしてあげる
        var newBgm = BgmBuffer.arrangeNewBgm(_newBgm, AudioManager._currentBgm);

        AudioManager._bgmArray.push(newBgm);

        // 無名BGMも曲として扱うが、バッファーとしてはnull
        if (newBgm.name === "") {
          AudioManager._bgmBufferArray.push(null);
        } else if (newBgm.name !== null) {
          // 暗号化されたオーディオファイルの場合 @TODO 通らないっぽいので消してもいいかも
          if (Decrypter.hasEncryptedAudio && AudioManager.shouldUseHtml5Audio()) {
            var ext = AudioManager.audioFileExt();
            var url = AudioManager._path + 'bgm/' + encodeURIComponent(bgm.name) + ext;
            url = Decrypter.extToEncryptExt(url);
            Decrypter.decryptHTML5Audio(url, bgm, bgm.pos);
            AudioManager._blobUrl = url;
          }
          AudioManager._bgmBufferArray.push(AudioManager.createBuffer('bgm', newBgm.name));
        } else {
          console.warn("!!WARN!! next bgm name is null @ pushBuffer");
          AudioManager._bgmBufferArray.push(null); // _bgmArray の個数と整合性を保つため挿入
        }
      }

      /**
       * バッファーを先頭に足す
       *
       * @param _newBgm: Array 例 {name: "bgm_title", volume: 90, pitch: 100, pan: 0, pos: 0}
       */

    }, {
      key: "unshiftBuffer",
      value: function unshiftBuffer(_newBgm) {
        // 未定義の部分は現在の曲の値をセットしてあげる
        var newBgm = BgmBuffer.arrangeNewBgm(_newBgm, AudioManager._currentBgm);

        AudioManager._bgmArray.unshift(newBgm);

        // 無名BGMも曲として扱うが、バッファーとしてはnull
        if (newBgm.name === "") {
          AudioManager._bgmBufferArray.unshift(null);
        } else if (newBgm.name !== null) {
          // 暗号化されたオーディオファイルの場合 @TODO 通らないっぽいので消してもいいかも
          if (Decrypter.hasEncryptedAudio && AudioManager.shouldUseHtml5Audio()) {
            var ext = AudioManager.audioFileExt();
            var url = AudioManager._path + 'bgm/' + encodeURIComponent(bgm.name) + ext;
            url = Decrypter.extToEncryptExt(url);
            Decrypter.decryptHTML5Audio(url, bgm, bgm.pos);
            AudioManager._blobUrl = url;
          }

          AudioManager._bgmBufferArray.unshift(AudioManager.createBuffer('bgm', newBgm.name));
        } else {
          console.warn("!!WARN!! next bgm name is null @ unshiftBuffer");
          AudioManager._bgmBufferArray.unshift(null); // _bgmArray の個数と整合性を保つため挿入
        }
      }

      /**
       * バッファーの個数を数える
       *
       * @return Number
       */

    }, {
      key: "countBuffers",
      value: function countBuffers() {
        return AudioManager._bgmBufferArray.length;
      }

      /**
       * すべてのバッファーの再生を止める
       */

    }, {
      key: "muteAllBuffers",
      value: function muteAllBuffers() {
        AudioManager._bgmBufferArray.forEach(function (buffer) {
          if (buffer !== null) {
            buffer.stop();
          }
        });
      }

      /**
       * すべてのバッファーを再生する
       */

    }, {
      key: "playAllBuffers",
      value: function playAllBuffers() {
        AudioManager._bgmBufferArray.forEach(function (buffer, index) {
          if (buffer !== null) {
            var audioParameter = AudioManager._bgmArray[index];

            if (audioParameter !== null) {
              AudioManager.updateBufferParameters(buffer, AudioManager._bgmVolume, audioParameter);
              buffer.play(true, audioParameter.pos || 0);
            }
          }
        });
      }

      /**
       * index(0~)を指定し、対象のバッファーを再生する
       *
       * @param _index: Number 対象バッファーの、バッファー配列におけるインデックス(0~)
       */

    }, {
      key: "playBufferByIndex",
      value: function playBufferByIndex(_index) {
        var index = parseInt(_index);
        var length = BgmBuffer.countBuffers();

        if (0 <= index && index < length) {
          var buffer = AudioManager._bgmBufferArray[index];

          if (buffer !== null) {
            var audioParameter = AudioManager._bgmArray[index];

            if (audioParameter !== null) {
              AudioManager.updateBufferParameters(buffer, AudioManager._bgmVolume, audioParameter);
              buffer.play(true, audioParameter.pos || 0);
            }
          }
        } else {
          console.warn("!!WARN!! index number is not valid @ playBufferByIndex");
        }
      }

      /**
       * バッファーを指定個数に減らす
       *
       * @param quantity: Number この数に buffer の個数を減らす
       */

    }, {
      key: "reduceBuffers",
      value: function reduceBuffers(_quantity) {
        var quantity = parseInt(_quantity);
        var length = BgmBuffer.countBuffers();

        for (var i = quantity; i < length; ++i) {
          if (AudioManager._bgmBufferArray[i] !== null) {
            AudioManager._bgmBufferArray[i].stop();
            AudioManager._bgmBufferArray[i] = null;
          }
        }
        AudioManager._bgmArray = AudioManager._bgmArray.slice(0, quantity);
        AudioManager._bgmBufferArray = AudioManager._bgmBufferArray.slice(0, quantity);
      }

      /**
       * index(0~)を指定し、対象のバッファーを削除する
       *
       * @param _index: Number 対象バッファーの、バッファー配列におけるインデックス(0~)
       */

    }, {
      key: "removeBufferByIndex",
      value: function removeBufferByIndex(_index) {
        var index = parseInt(_index);
        var length = BgmBuffer.countBuffers();

        var newBgmArray = [];
        var newBgmBufferArray = [];

        if (0 <= index && index < length) {
          for (var i = 0; i < length; ++i) {
            if (i !== index) {
              newBgmArray.push(AudioManager._bgmArray[i]);
              newBgmBufferArray.push(AudioManager._bgmBufferArray[i]);
            } else {
              AudioManager._bgmBufferArray[i].stop();
              AudioManager._bgmBufferArray[i] = null;
              AudioManager._bgmArray[i] = null;
            }
          }

          AudioManager._bgmArray = newBgmArray;
          AudioManager._bgmBufferArray = newBgmBufferArray;
        } else {
          console.warn("!!WARN!! index number is not valid @ removeBufferByIndex");
        }
      }

      /**
       * index(0~)を指定し、対象のバッファーをアップデート
       *
       * @param _index: Number アップデート対象とするバッファーの、バッファー配列におけるインデックス(0~)
       * @param _newBgm: Array 例 {name: "bgm_title", volume: 90, pitch: 100, pan: 0, pos: 0}
       */

    }, {
      key: "updateBufferByIndex",
      value: function updateBufferByIndex(_index, _newBgm) {
        var index = parseInt(_index);
        var length = BgmBuffer.countBuffers();

        if (0 <= index && index < length) {
          var buffer = AudioManager._bgmBufferArray[index];
          var currentBgm = AudioManager._bgmArray[index];
          var newBgm = BgmBuffer.arrangeNewBgm(_newBgm, currentBgm);

          AudioManager._bgmArray[index] = newBgm;
          AudioManager.updateBufferParameters(buffer, AudioManager._bgmVolume, newBgm);
        } else {
          console.warn("!!WARN!! index number is not valid @ updateBufferByIndex");
        }
      }

      /**
       * BGM名をもとにバッファー一覧を検索し、対象のバッファーをアップデート
       *
       * @param _bgmName: String 更新したい BGM名
       * @param _newBgm: Array 例 {name: "bgm_title", volume: 90, pitch: 100, pan: 0, pos: 0}
       */

    }, {
      key: "updateBufferByBgmName",
      value: function updateBufferByBgmName(_bgmName, _newBgm) {
        var bgmName = String(_bgmName);

        AudioManager._bgmArray.forEach(function (bgm, index) {
          if (bgm.name === bgmName) {
            var buffer = AudioManager._bgmBufferArray[index];
            var currentBgm = AudioManager._bgmArray[index];
            var newBgm = BgmBuffer.arrangeNewBgm(_newBgm, currentBgm);

            AudioManager._bgmArray[index] = newBgm;
            AudioManager.updateBufferParameters(buffer, AudioManager._bgmVolume, newBgm);
          }
        });
      }

      /**
       * 未定義の値は currentBgm の値を使うよう調整
       *
       * @param _newBgm: Array 新しい BGM
       * @param _currentBgm: Array 現在の BGM
       * @return newBgm: Array 調整された新しい BGM
       */

    }, {
      key: "arrangeNewBgm",
      value: function arrangeNewBgm(_newBgm, _currentBgm) {
        var newBgm = _newBgm;

        if (newBgm.name === null) {
          newBgm.name = _currentBgm.name;
        }
        if (newBgm.volume === null) {
          newBgm.volume = _currentBgm ? _currentBgm.volume : 90;
        }
        if (newBgm.pitch === null) {
          newBgm.pitch = _currentBgm ? _currentBgm.pitch : 100;
        }
        if (newBgm.pan === null) {
          newBgm.pan = _currentBgm ? _currentBgm.pan : 0;
        }
        if (newBgm.pos === null) {
          newBgm.pos = _currentBgm ? _currentBgm.pos : 0;
        }

        return newBgm;
      }

      /**
       * index(0~)を指定し、対象のバッファーをフェードイン
       *
       * @param _index: Number アップデート対象とするバッファーの、バッファー配列におけるインデックス(0~)
       * @param _fadeDurationSec: Number フェードインにかける時間（秒）
       */

    }, {
      key: "fadeInBufferByIndex",
      value: function fadeInBufferByIndex(_index, _fadeDurationSec) {
        var index = parseInt(_index);
        var fadeDurationSec = Number(_fadeDurationSec);
        var length = BgmBuffer.countBuffers();

        if (0 <= index && index < length) {
          var buffer = AudioManager._bgmBufferArray[index];

          if (buffer !== null) {
            buffer.fadeIn(fadeDurationSec);
          }
        } else {
          console.warn("!!WARN!! index number is not valid @ fadeInBufferByIndex");
        }
      }

      /**
       * index(0~)を指定し、対象のバッファーをフェードアウト
       *
       * @param _index: Number アップデート対象とするバッファーの、バッファー配列におけるインデックス(0~)
       * @param _fadeDurationSec: Number フェードアウトにかける時間（秒）
       */

    }, {
      key: "fadeOutBufferByIndex",
      value: function fadeOutBufferByIndex(_index, _fadeDurationSec) {
        var index = parseInt(_index);
        var fadeDurationSec = Number(_fadeDurationSec);
        var length = BgmBuffer.countBuffers();

        if (0 <= index && index < length) {
          var buffer = AudioManager._bgmBufferArray[index];

          if (buffer !== null) {
            buffer.fadeOut(fadeDurationSec);
          }
        } else {
          console.warn("!!WARN!! index number is not valid @ fadeOutBufferByIndex");
        }
      }
    }, {
      key: "getBuffersPositionByIndex",
      value: function getBuffersPositionByIndex(_index) {
        var index = parseInt(_index);
        var length = BgmBuffer.countBuffers();

        if (0 <= index && index < length) {
          var buffer = AudioManager._bgmBufferArray[index];

          if (buffer !== null) {
            return buffer.seek() || 0;
          } else {
            return null;
          }
        } else {
          console.warn("!!WARN!! index number is not valid @ fadeInBufferByIndex");
        }
      }
    }]);

    return BgmBuffer;
  }();

  var CrossFadeBgm = function () {
    function CrossFadeBgm() {
      _classCallCheck(this, CrossFadeBgm);

      // プラグインパラメーターからデフォルトフェード時間を設定
      var parameters = PluginManager.parameters(pluginName);
      this._defaultDurationSec = Number(parameters["Default Fade Duration Sec"]);
      this.durationSec = this.defaultDurationSec;

      this.bgmBuffer = new BgmBuffer();

      this.nextBgm = {
        name: ""
      };
    }

    /** defaultDurationSec を取得、set はしない */


    _createClass(CrossFadeBgm, [{
      key: "startCrossFade",


      /** クロスフェードを開始 */
      value: function startCrossFade() {
        if (AudioManager._currentBgm !== null) {
          if (this.nextBgm.name !== AudioManager._currentBgm.name) {
            this.nextBgm = BgmBuffer.arrangeNewBgm(this.nextBgm, AudioManager._currentBgm);

            var position = BgmBuffer.getBuffersPositionByIndex(0);
            this.nextBgm.pos = position;
            AudioManager._currentBgm.pos = position;

            BgmBuffer.unshiftBuffer(this.nextBgm);
            BgmBuffer.reduceBuffers(2);
            BgmBuffer.playAllBuffers();

            BgmBuffer.fadeInBufferByIndex(0, this.durationSec * 0.75);
            BgmBuffer.fadeOutBufferByIndex(1, this.durationSec);
          }
        } else {
          BgmBuffer.unshiftBuffer(this.nextBgm);
          BgmBuffer.reduceBuffers(2);
          BgmBuffer.playAllBuffers();
          BgmBuffer.fadeInBufferByIndex(0, this.durationSec * 0.75);
        }
      }

      /** フェード時間(s)を設定 */

    }, {
      key: "setDuration",
      value: function setDuration(durationSec) {
        this.durationSec = Number(durationSec);
      }

      /** フェード時間(s)をデフォルトにリセット */

    }, {
      key: "resetDuration",
      value: function resetDuration() {
        this.durationSec = this.defaultDurationSec;
      }

      /**
       * 次に流すBGMをまとめて設定
       *
       * name,volume,pan,pitch,pos の順でまとめて書く
       * カンマのあとに空白文字を置かないこと
       *
       * @param _args: String
       */

    }, {
      key: "setAll",
      value: function setAll(_args) {
        var argsArray = _args.split(",");

        var name = argsArray[0] !== undefined && argsArray[0] !== "" ? String(argsArray[0]) : null;
        var volume = argsArray[1] !== undefined && argsArray[1] !== "" ? Number(argsArray[1]) : null;
        var pan = argsArray[2] !== undefined && argsArray[2] !== "" ? Number(argsArray[2]) : null;
        var pitch = argsArray[3] !== undefined && argsArray[3] !== "" ? Number(argsArray[3]) : null;
        var pos = argsArray[4] !== undefined && argsArray[4] !== "" ? Number(argsArray[4]) : null;

        this.nextBgm = {
          name: name,
          volume: volume,
          pan: pan,
          pitch: pitch,
          pos: pos
        };
      }

      /**
       * プラグインコマンドを登録
       */

    }, {
      key: "defaultDurationSec",
      get: function get() {
        return this._defaultDurationSec;
      }
    }], [{
      key: "initPluginCommands",
      value: function initPluginCommands() {
        var crossFadeBgmClass = new CrossFadeBgm();

        var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;

        Game_Interpreter.prototype.pluginCommand = function (command, args) {
          _Game_Interpreter_pluginCommand.call(this, command, args);
          if (command === "CrossFadeBgm") {
            switch (args[0]) {
              case "set":
                crossFadeBgmClass.setAll(args[1]);
                break;
              case "start":
                crossFadeBgmClass.startCrossFade();
                break;
              case "durationSec":
                crossFadeBgmClass.setDuration(args[1]);
                break;
              case "resetDuration":
                crossFadeBgmClass.resetDuration();
                break;
            }
          }
        };
      }
    }]);

    return CrossFadeBgm;
  }();

  CrossFadeBgm.initPluginCommands();
})();