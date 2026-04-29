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
    const setting = ref({
      process: 'calc-evalue',
      unitName: '',
      options: {
        autoSuccess: true,
        preRoll: true,
        altRoll: true,
        actLoss: true,
      },
      save: {
        setting: true,
        sancData: true,
        unitData: true,
      }
    });

    const initInsanity = ref('');

    const unitDataDic = ref({});
    const unitData = computed(() => unitDataDic.value[setting.value.unitName] ?? {skill:{}});
    watch(unitData, ()=>{if ('san' in unitData.value) initInsanity.value = unitData.value.san;});

    class SancData {
      sancText = '';
      isPlus = false;

      autoSuccess = '';
      preRoll = {skill: '', adjustment: '', isFail: false,};
      altRoll = {skill: '', adjustment: '',};
      actLoss = '';

      constructor (
        sancText='', 
        isPlus=false, 
        autoSuccess='', 
        preRoll={}, 
        altRoll={}, 
        actLoss=''
      ) {
        if (sancText) this.sancText = sancText;
        if (isPlus) this.isPlus = isPlus;
        if (autoSuccess) this.autoSuccess = autoSuccess;
        if ('skill' in preRoll) this.preRoll = preRoll;
        if ('skill' in altRoll) this.altRoll = altRoll;
        if (actLoss) this.actLoss = actLoss;
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
                const {num, dice} = str.match(/^(?<num>\d+)D(?<dice>\d+)$/i)?.groups ?? {};
                ex += parseInt(num) * (1+parseInt(dice)) / 2;
              }
            });
          return ex;
        }
      }
    }
    const sancDataArr = ref([]);
    const sanDataArr = computed(() => {
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
            applyAdjustment(unitData.value.skill[sancData.preRoll.skill], adjustment);
          preRollRate = clamp(preRollRate, 0, 100);
        }

        // option 3 : 判定値
        let altRollRate = null;
        if (setting.value.options.altRoll && sancData.altRoll.skill !== '') {
          const adjustment = sancData.altRoll.adjustment;
          altRollRate = sancData.altRoll.skill==='else' ?
            (parseInt(adjustment) || 0) : 
            applyAdjustment(unitData.value.skill[sancData.altRoll.skill], adjustment);
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
    const allSanLoss = computed(() => {return sanDataArr.value.at(-1) ? initInsanity.value - sanDataArr.value.at(-1).remainSan : 0;});
    sancDataArr.value.push(new SancData());
    sancDataArr.value.push(new SancData());


    function saveJson () {
      const json = {};
      if (setting.value.save.setting) json.setting = setting.value;
      if (setting.value.save.sancData) json.sancData = sancDataArr.value;
      if (setting.value.save.unitData) {
        json.unitData = unitDataDic.value;
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

      // setting
      if ('setting' in json) setting.value = structuredClone(json.setting);
      // sancData
      if ('sancData' in json) sancDataArr.value = json.sancData.map(data => new SancData(...Object.values(data)));
      // unitData
      if ('unitData' in json) unitDataDic.value = structuredClone(json.unitData);
    }

    function clear () {
      initInsanity.value = '';
      unitDataDic.value = {};
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
    const dragEnd = () => { dragIndex.value = null; };


    function addNewData () {sancDataArr.value.push(new SancData());}
    function deleteLastData() {sancDataArr.value.pop();}
    
    function clickNextInput(e) {e.currentTarget.nextElementSibling?.click();}
    

    // for test
    const testUnit1 = {
      san: 60,
      skill: { '目星':50, '聞き耳':60, '図書館':70, },
    };
    unitDataDic.value['test unit 1'] = testUnit1;



    onMounted(async () => {
      const json = await fetch('./setting.json').then(res=>res.json());
      setting.value = json.setting;
      document.querySelector('footer table tbody').innerHTML = json.changeLog
      .reduce((acc, cur) => acc += `<tr><td>${cur.date}</td><td>${cur.version}</td><td>${cur.detail}</td></tr>`, '');
    })



    return {
      setting,
      initInsanity,
      allSanLoss,
      unitDataDic,
      unitData,
      sancDataArr,
      sanDataArr,

      dragIndex,
      dragStart,
      dragEnter,
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