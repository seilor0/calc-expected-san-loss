import ButtonCssIcon from "./components/button-css-icon.js";
import ButtonTag from "./components/button-tag.js";
import ToggleButton from "./components/toggle-button.js";
import { clamp, floatRound, applyAdjustment, clickNextInput } from "../__utility/function.js";

const {createApp, ref, computed, watch, onMounted, toRaw} = Vue;

const rootApp = createApp({
  components: {
    ButtonCssIcon,
    ButtonTag,
    ToggleButton,
  },

  setup () {
    class UnitData {
      constructor ({
        save=true, 
        san=null, 
        skill={}
      } = {}) {
        this.save = save;
        this.san = san;
        this.skill = skill;
      }
    }
    class SancData {
      constructor ({
        sancText='', 
        isPlus=false, 
        autoSuccess='',
        preRoll={skill: '', adjustment: '', isFail: false,}, 
        altRoll={skill: '', adjustment: ''}, 
        actLoss=''
      } = {}) {
        this.sancText = sancText;
        this.isPlus = isPlus;
        this.autoSuccess = autoSuccess;
        this.preRoll = preRoll;
        this.altRoll = altRoll;
        this.actLoss = actLoss;
      }

      get sancExDic () {
        const splitArr = this.sancText.split('/');
        if (splitArr.length===1)
          return {single: true, ex: calcEx(this.sancText)};
        else if (splitArr.length===2)
          return {single: false, sucEx: calcEx(splitArr[0]), failEx: calcEx(splitArr[1])};
        else {
          console.log('out of sancText-text-format.');
          return null;
        }
        function calcEx(diceText) {
          let ex = 0;
          diceText
            .split('+')
            .forEach(str => {
              if (/^\d+$/.test(str)) ex += parseInt(str);
              else if (/^\d+D\d+$/i.test(str)) {
                const {num=0, dice=0} = str.match(/^(?<num>\d+)D(?<dice>\d+)$/i)?.groups ?? {};
                ex += parseInt(num) * (1+parseInt(dice)) / 2;
              }
            });
          return ex;
        }
      }
    }
    class SancRegData {
      constructor ({
        sample = '',
        single = false,
        isPlus = false,
        preText = '',
        nextText = '',
      }={}) {
        this.sample = sample;
        this.single = single;
        this.isPlus = isPlus;
        this.preText = preText;
        this.nextText = nextText;
      }
      get regString() {
        let text = this.preText ? `(?<=${this.preText}[${sancBeforeChar.value}]*)` : '';
        const diceString = '\\d[+D\\d]*';
        text += this.single ? `(?<sancText>${diceString})` : `(?<sancText>${diceString}\\/${diceString})`;
        if (this.nextText) text += `[${sancAfterChar.value}]*${this.nextText}`;
        return text;
      }
    }
    const setting = ref({
      process: 'home',
      unit: '',
      options: {
        autoSuccess: true,
        preRoll: true,
        altRoll: true,
        actLoss: true,
      },
      save: {
        setting: true,
        sancData: true,
        unit: true,
      },
    });


    // --------------------------
    // PAGE : home
    // --------------------------
    const changeLogArr = ref([]);


    // --------------------------
    // PAGE : calc sanc e-value
    // --------------------------
    const initInsanity = ref('');

    const unitDic = ref({});
    const unit = computed(() => unitDic.value[setting.value.unit] ?? new UnitData());
    watch(unit, (newData)=>{if (typeof(newData.san)==='number') initInsanity.value = newData.san;});
    function addNewData () {sancDataArr.value.push(new SancData());}
    function deleteLastData() {sancDataArr.value.pop();}


    // FEATURE : edit unit data
    const editUnitArr = ref([]);
    const editUnitIndex = ref(0);
    const editUnit = computed(()=>editUnitArr.value[editUnitIndex.value] ?? {name:'', san:'', skillText:''});
    let unitIndex = null;

    function startUnitEdit () {
      // 表示名のidを記憶
      unitIndex = Object.keys(unitDic.value).findIndex(name=>name===setting.value.unit);
      if (unitIndex !== -1) editUnitIndex.value = unitIndex;
      // 編集用データをインポート
      editUnitArr.value = Object.entries(unitDic.value).map(([name,data], index)=>{
        const dic = {id: index, name: name, san: data.san, save: data.save, skillText: ''};
        const skillText = Object.entries(data.skill).map(([key,value]) => `${key}\t${value}`).join('\n');
        dic.skillText = skillText;
        return dic;
      });
    }
    function endUnitEdit () {
      // 表示名への変更を反映
      if (unitIndex !== -1) setting.value.unit = editUnitArr.value.find(dic=>dic.id===unitIndex)?.name ?? '';
      unitIndex = null;
      // ユニットデータへエクスポート
      unitDic.value = Object.fromEntries(
        editUnitArr.value.map(dic => {
          const name = dic.name || `character ${dic.id+1}`;
          const skillArr = [];
          [
            [/　/g, ' '],
            [/[！-｝]/g, (s)=>String.fromCharCode(s.charCodeAt(0)-0xFEE0)],
          ]
            .reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), dic.skillText)
            .split('\n')
            .filter(Boolean)
            .forEach(row => {
              const {skill, value} = row.match(/(?<skill>.+)\b(?<value>\d+)$/)?.groups ?? {};
              if (!skill) return;
              skillArr.push([skill.trim(), parseFloat(value)]);
            });
          return [name, new UnitData({save: dic.save, san: dic.san, skill:Object.fromEntries(skillArr)})];
        })
      );
      // 編集用データをクリア
      editUnitArr.value.splice(0);
      editUnitIndex.value = 0;
    }
    function addNewEditUnit () {
      editUnitIndex.value = editUnitArr.value.length;
      editUnitArr.value.push({ id: editUnitArr.value.length, name: '', san: '', skillText: '' });
    }
    function deleteEditUnit (index) {
      editUnitArr.value.splice(index,1);
      if (index < editUnitIndex.value) editUnitIndex.value--;
    }
    function importCcfolia () {
      const ccfoliaText = window.prompt('貼付け：ココフォリア駒 or チャパレテキスト');
      // id
      const newId = editUnitArr.value.length;
      editUnitIndex.value = newId;

      // コマテキスト
      if (ccfoliaText.startsWith('{')) {
        const ccfoliaJson = JSON.parse(ccfoliaText);

        // name
        const name = ccfoliaJson.data.name;

        // san
        const san = ccfoliaJson.data.status.find(dic=>dic.label==='SAN').value ?? '';

        // skill
        // --チャパレ
        const skillArr = chatpalette2arr(ccfoliaJson.data.commands);
        // --能力値
        ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'].forEach(key => {
          const value = ccfoliaJson.data.params.find(dic=>dic.label===key).value ?? null;
          if (value) skillArr.push(`${key}\t${value}`);
        });
        // --幸運：7版

        editUnitArr.value.push({ id: newId, name: name, san: san, skillText: skillArr.join('\n')});
      } 
      // チャパレテキスト
      else {
        const skillArr = chatpalette2arr(ccfoliaText);
        editUnitArr.value.push({ id: newId, name: '', san: '', skillText: skillArr.join('\n')});
      }
      function chatpalette2arr (commandText) {
        const resultArr = [];
        [
          [/^.*<=\{.*\}.*$/mg, ''], 
          [/　/g, ' '],
          [/[！-｝]/g, (s)=>String.fromCharCode(s.charCodeAt(0)-0xFEE0)],
          [/[「」『』【】〈〉\\[\\]《》≪≫]/g, ''],
          [/^(?:x|rep|repeat)\d+ */mgi, ''] // 複数回ロール
        ]
          .reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), commandText)
          .split('\n')
          .filter(Boolean)
          .forEach(base => {
            const dic = {name: '', value: null};
            // // 複数回ロール
            // if (/^(?:x|rep|repeat)\d+/i.test(base)) base = base.replace(/(?:x|rep|repeat)\d+ */i, '');

            // 組み合わせロール
            if (/CBR/i.test(base)) {
              const {val, val1, val2} = base.match(/(?<val>CBRB?\D*(?<val1>\d+)\D+(?<val2>\d+)\)?)/i)?.groups || {};
              if (!val1 || !val2) return;
              const name = base.replace(val, '').trim();
              if (!name) return;
              const targetValue = Math.min(parseInt(val1), parseInt(val2));
              dic.name = name;
              dic.value = targetValue;

            // CCB<=70 skill
            } else if (/(?:1d100|CCB?)<=/i.test(base)) {
              const {value, name} = base.match(/(?:1d100|CCB?)<=(?<value>\d+) *(?<name>.*)/i)?.groups || {};
              if(!name || !value) return;
              dic.name = name;
              dic.value = value;

            // CCB skill @70
            } else if (/(?:1d100|CCB?).*@\d+$/i.test(base)) {
              const {name, value} = base.match(/(?:1d100|CCB?) *(?<name>.*) *@(?<value>\d+)$/i)?.groups || {};
              if(!name || !value) return;
              dic.name = name;
              dic.value = value;

            } else return;

            dic.name = [['(', '（'], [')', '）'], [':','：']].reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), dic.name).trim();
            resultArr.push(`${dic.name}\t${dic.value}`);
          });
        
        return resultArr;
      }
    }

    const sancDataArr = ref([]);
    const calcedArr = computed(() => {
      const resultArr = [];
      let remain = initInsanity.value || 0;
      sancDataArr.value.forEach((sancData, i) => {
        if (!sancData.sancExDic) return;

        // option 2 : 発生率
        let preRollRate = null;
        if (setting.value.options.preRoll && sancData.preRoll.skill!=='') {
          const adjustment = sancData.preRoll.adjustment;
          preRollRate = sancData.preRoll.skill==='else' ? 
            (parseInt(adjustment) || 0) : 
            applyAdjustment(unit.value.skill[sancData.preRoll.skill], adjustment);
          preRollRate = clamp(preRollRate, 0, 100);
          if (sancData.preRoll.isFail) preRollRate = 100 - preRollRate;
        }

        // option 3 : 判定値
        let altRollRate = null;
        if (setting.value.options.altRoll && sancData.altRoll.skill !== '') {
          const adjustment = sancData.altRoll.adjustment;
          altRollRate = sancData.altRoll.skill==='else' ?
            (parseInt(adjustment) || 0) : 
            applyAdjustment(unit.value.skill[sancData.altRoll.skill], adjustment);
          altRollRate = clamp(altRollRate, 0, 100);
        }

        let lossEx;
        if (sancData.sancExDic.single)
          lossEx = sancData.sancExDic.ex;

        // option 1
        else if (sancData.autoSuccess !== '') {
          lossEx = sancData.autoSuccess==='success' ? sancData.sancExDic.sucEx : sancData.sancExDic.failEx;
          // option 2
          if (preRollRate!==null) lossEx *= preRollRate/100;

        } else {
          // option 3
          const rate = clamp(altRollRate ?? remain, 0, 100) / 100;
          lossEx = sancData.sancExDic.sucEx * rate + sancData.sancExDic.failEx * (1-rate);
          // option 2
          if (preRollRate!==null) lossEx *= preRollRate/100;
        }

        // option 4
        const loss = setting.value.options.actLoss && Number.isInteger(sancData.actLoss) ? 
          sancData.actLoss : lossEx;
        remain += (sancData.isPlus ? 1 : -1) * loss;

        resultArr.push({lossEx:lossEx, remainSan:remain, preRoll:preRollRate, altRoll:altRollRate});
      });
      return resultArr;
    });
    const allSanLoss = computed(() => {return calcedArr.value.length ? initInsanity.value - calcedArr.value.at(-1).remainSan : 0;});


    // --------------------------
    // PAGE : get sanc list
    // --------------------------
    const scenarioText = ref('');
    const sancList = ref([]);

    const sancRegArr = ref([]);
    const sancBeforeChar = ref('');
    const sancAfterChar = ref('');
    function addNewRegData() {sancRegArr.value.push(new SancRegData());}
    function deleteLastRegData() {sancRegArr.value.pop();}

    watch(
      scenarioText, 
      (newText, oldText) => {
        scenarioText.value = [
          [/[　 ]/g, ''],
          [/[！-｝]/g, (s)=>String.fromCharCode(s.charCodeAt(0)-0xFEE0)],
        ].reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), newText);
        extractSanc(false, newText, oldText);
      }
    );
    watch(
      [sancRegArr, sancBeforeChar, sancAfterChar], 
      () => extractSanc(true, scenarioText.value), {deep:true}
    );

    function extractSanc(regIsChange=false, newText, oldText='') {
      console.log('extract sanc');
      const matchReg = new RegExp(sancRegArr.value.map(reg=>reg.regString).join('|'),'gi');
      const testReg = new RegExp(sancRegArr.value.map(reg=>reg.regString).join('|'),'i');
      const newArr = newText.split('\n').filter(row=>/san|正気度/i.test(row));

      if (!oldText || regIsChange) {
        sancList.value = newArr.map(row => extract(row));

      } else {
        const oldArr = oldText.split('\n').filter(row=>/san|正気度/i.test(row));
        if (newArr.length < oldArr.length) {
          sancList.value.splice(newArr.length);
        } else if (newArr.length > oldArr.length) {
          sancList.value.length = newArr.length;
          sancList.value.fill([], oldArr.length);
        }
        newArr.forEach((row,index) => {
          if (row===oldArr[index]) return;
          sancList.value[index] = extract(row);
        });
      }
      function extract(string) {
        // if (!/san|正気度/i.test(string)) return [];
        if (!testReg.test(string)) return [{sancText:'', isPlus:false, enable:false, base:string}];
        const matchArr = [...string.matchAll(matchReg)];
        const childArr = matchArr.map(match => {
          const {sancText} = match.groups;
          const i = match.slice(1).findIndex(text=>text!==undefined);
          const isPlus = sancRegArr.value[i].isPlus;
          return {sancText:sancText, isPlus:isPlus, enable:true, base:string};
        });
        return childArr;
      }
    }

    function importSancList() {
      sancDataArr.value = sancList.value
        .flat()
        .filter(dic => dic.enable)
        .map(dic => new SancData({sancText:dic.sancText, isPlus:dic.isPlus}));
      setting.value.process = 'calc-evalue';
    }
    


    // --------------------------
    // WHOLE feature
    // --------------------------
    function saveJson () {
      const json = {};
      if (setting.value.save.setting) {
        json.setting = setting.value;
        json.sancRegData = {
          beforeChar: sancBeforeChar.value,
          afterChar: sancAfterChar.value,
          regExp: sancRegArr.value,
        }
      }
      if (setting.value.save.sancData) json.sancData = sancDataArr.value;
      if (setting.value.save.unit) {
        json.unit = Object.fromEntries(
          Object.entries(unitDic.value).filter(([key, value])=>value.save)
        );
      }
      const jsonString = JSON.stringify(json);

      // save
      const blob = new Blob([jsonString], {type:'text/plain'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const date = new Date();
      const dateText = `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;

      link.download = `sancdata-${dateText}.json`;
      link.click();
    }
    async function loadJson (e) {
      const file = e.currentTarget.files[0];
      if (!file) return;
      e.currentTarget.value = null;
      const json = JSON.parse(await file.text());

      if ('setting' in json) {
        setting.value = structuredClone(json.setting);
        sancBeforeChar.value = json.sancRegData.beforeChar;
        sancAfterChar.value = json.sancRegData.afterChar;
        sancRegArr.value = json.sancRegData.regExp.map(data => new SancRegData(data));
      }
      if ('sancData' in json) {
        sancDataArr.value = json.sancData.map(data => new SancData(data));
      }
      if ('unit' in json) {
        unitDic.value = Object.fromEntries(
          Object.entries(json.unit).map(([key, value]) => [key, new UnitData(value)])
        );
      }
    }
    function clear () {
      initInsanity.value = '';
      unitDic.value = {};
      sancDataArr.value.splice(0);
      sancDataArr.value.push(new SancData());
      sancDataArr.value.push(new SancData());  
    }

    // FEATURE : swith data
    const dragIndex = ref(null);
    const dragTarget = ref('');
    const dragStart = (index, target) => {
      dragIndex.value = index;
      dragTarget.value = target;
    };
    const dragEnter = (index) => {
      if (index === dragIndex.value) return;
      const target = dragTarget.value==='sancDataArr' ? sancDataArr.value : sancRegArr.value;
      const deleteElement = target.splice(dragIndex.value, 1)[0];
      target.splice(index, 0, deleteElement);
      dragIndex.value = index;
      console.log(target);
    };
    const dragEnter2NameLabel = (index) => {
      if (index === dragIndex.value) return;
      const deleteElement = editUnitArr.value.splice(dragIndex.value, 1)[0];
      editUnitArr.value.splice(index, 0, deleteElement);
      if (index === editUnitIndex.value) {
        if (dragIndex.value < index) editUnitIndex.value--;
        else editUnitIndex.value++;
      } else if (dragIndex.value === editUnitIndex.value) {
        if (dragIndex.value < index) editUnitIndex.value++;
        else editUnitIndex.value--;
      }
      dragIndex.value = index;
    };
    const dragEnd = () => {
      dragIndex.value = null;
      dragTarget.value = '';
    };
    

    // --------------------------
    // TEST
    // --------------------------
    // unitDic.value['test unit 1'] = new UnitData({san:60, skill: { '目星':50, '聞き耳':60, '図書館':70, },});
    // unitDic.value['test unit 2'] = new UnitData({san:0, skill: { '目星':50, '聞き耳':60, '図書館':70, },});



    onMounted(async () => {
      const changeLogJson = await fetch('./data/change-log.json').then(res=>res.json());
      changeLogArr.value = structuredClone(changeLogJson);
      const settingJson = await fetch('./data/setting.json').then(res=>res.json());
      setting.value = structuredClone(settingJson);
      const sancRegJson = await fetch('./data/sanc-reg-exp.json').then(res=>res.json());
      sancRegArr.value = sancRegJson.regExp.map(dic=>new SancRegData(dic));
      sancBeforeChar.value = sancRegJson.beforeChar;
      sancAfterChar.value = sancRegJson.afterChar;
      sancDataArr.value.push(new SancData());
      sancDataArr.value.push(new SancData());
    })



    return {
      setting,

      // PAGE : home
      changeLogArr,

      // PAGE : calc sanc e-value
      initInsanity,

      unitDic,
      unit,
      addNewData,
      deleteLastData,

      editUnitArr,
      editUnitIndex,
      editUnit,
      startUnitEdit,
      endUnitEdit,
      addNewEditUnit,
      deleteEditUnit,
      importCcfolia,
      
      sancDataArr,
      calcedArr,
      allSanLoss,

      // PAGE : get sanc list
      scenarioText,
      sancList,
      sancRegArr,
      sancBeforeChar,
      sancAfterChar,
      addNewRegData,
      deleteLastRegData,
      importSancList,

      // WHOLE feature
      saveJson,
      loadJson,
      clear,

      dragIndex,
      dragTarget,
      dragStart,
      dragEnter,
      dragEnter2NameLabel,
      dragEnd,

      // FUNCTION
      clickNextInput,
      floatRound,
    }
  }
});
rootApp.mount('#root');