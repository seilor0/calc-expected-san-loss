import ButtonCssIcon from "./components/button-css-icon.js";
import ButtonTag from "./components/button-tag.js";
import ToggleButton from "./components/toggle-button.js";
import { clamp, floatRound, applyAdjustment } from "../__utility/function.js";

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


    const setting = ref({
      process: 'calc-evalue',
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
      }
    });

    const initInsanity = ref('');

    const unitDic = ref({});
    const unit = computed(() => unitDic.value[setting.value.unit] ?? new UnitData());
    watch(unit, (newData)=>{if (typeof(newData.san)==='number') initInsanity.value = newData.san;});

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
      if (unitIndex !== -1) setting.value.unit = editUnitArr.value.find(dic=>dic.id===unitIndex).name;
      unitIndex = null;
      // ユニットデータへエクスポート
      unitDic.value = Object.fromEntries(
        editUnitArr.value
          .filter(dic=>dic.name)
          .map(dic => {
            const skillArr = [];
            dic.skillText
              .split('\n')
              .filter(Boolean)
              .forEach(row => {
                const {skill, value} = row.match(/(?<skill>.+)\b(?<value>\d+)$/)?.groups ?? {};
                if (!skill) return;
                skillArr.push([skill.trim(), parseFloat(value)]);
              });
            return [dic.name, new UnitData({save: dic.save, san: dic.san, skill:Object.fromEntries(skillArr)})];
          })
      );
      // 編集用データをクリア
      editUnitArr.value.splice(0);
      editUnitIndex.value = 0;
    }
    function addNewEditUnit () {
      editUnitArr.value.push({ id: editUnitArr.value.length, name: '', san: '', skillText: '' });
    }
    function deleteEditUnit (index) {
      editUnitArr.value.splice(index,1);
      if (index < editUnitIndex.value) editUnitIndex.value--;
    }
    function importCcfolia () {
      const ccfoliaText = window.prompt('ココフォリア駒を貼付');
      // id
      const newId = editUnitArr.value.length;

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
          [/[！-｝]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); }],
          [new RegExp(`[「」『』【】〈〉\\[\\]《》≪≫]`, 'g'), ''],
        ]
          .reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), commandText)
          .split('\n')
          .filter(Boolean)
          .forEach(base => {
            const dic = {name: '', value: null};
            // 複数回ロール
            if (/^(?:x|rep|repeat)\d+/i.test(base)) base = base.replace(/(?:x|rep|repeat)\d+ */i, '');

            // 組み合わせロール
            if (/CBR/i.test(base)) {
              const {val, val1, val2} = base.match(/(?<val>CBRB?\D*(?<val1>\d+)\D+(?<val2>\d+)\)?)/i)?.groups || {};
              if (!val1 || !val2) return;
              const name = base.replace(val, '').trim();
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
        else if (sancData.autoSuccess !== '')
          lossEx = sancData.autoSuccess==='success' ? sancData.sancExDic.sucEx : sancData.sancExDic.failEx;

        else {
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


    function saveJson () {
      const json = {};
      if (setting.value.save.setting) json.setting = setting.value;
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

      if ('setting' in json) setting.value = structuredClone(json.setting);
      if ('sancData' in json) sancDataArr.value = json.sancData.map(data => new SancData(data));
      if ('unit' in json)
        unitDic.value = Object.fromEntries(
          Object.entries(json.unit).map(([key, value]) => [key, new UnitData(value)])
        );
    }

    function clear () {
      initInsanity.value = '';
      unitDic.value = {};
      sancDataArr.value.splice(0);
      sancDataArr.value.push(new SancData());
      sancDataArr.value.push(new SancData());  
    }

    
    const dragIndex = ref(null);
    const dragStart = (index) => { dragIndex.value = index; };
    const dragEnter = (index) => {
      if (index === dragIndex.value) return;
      const deleteElement = sancDataArr.value.splice(dragIndex.value, 1)[0];
      sancDataArr.value.splice(index, 0, deleteElement);
      dragIndex.value = index;
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
    const dragEnd = () => { dragIndex.value = null; };


    function addNewData () {sancDataArr.value.push(new SancData());}
    function deleteLastData() {sancDataArr.value.pop();}
    
    function clickNextInput(e) {e.currentTarget.nextElementSibling?.click();}
    

    // for test
    unitDic.value['test unit 1'] = new UnitData({san:60, skill: { '目星':50, '聞き耳':60, '図書館':70, },});
    unitDic.value['test unit 2'] = new UnitData({san:0, skill: { '目星':50, '聞き耳':60, '図書館':70, },});



    onMounted(async () => {
      const json = await fetch('./setting.json').then(res=>res.json());
      setting.value = json.setting;
      document.querySelector('footer table tbody').innerHTML = json.changeLog
      .reduce((acc, cur) => acc += `<tr><td>${cur.date}</td><td>${cur.version}</td><td>${cur.detail}</td></tr>`, '');

      sancDataArr.value.push(new SancData());
      sancDataArr.value.push(new SancData());
    })



    return {
      setting,
      initInsanity,

      unitDic,
      unit,
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

      dragIndex,
      dragStart,
      dragEnter,
      dragEnter2NameLabel,
      dragEnd,

      saveJson,
      loadJson,
      clear,

      addNewData,
      deleteLastData,
      clickNextInput,
      floatRound,
    }
  }
});
rootApp.mount('#root');