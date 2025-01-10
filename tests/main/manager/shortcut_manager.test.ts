import {ShortcutManager} from "../../../typescript_src/manager/shortcut_manager"



describe("short binding test", () => {
  ShortcutManager.getInstance().initialize();
  
  
  beforeEach(() => {
    temp = 1;
  });
  
  afterEach(() => {
    temp = 0;
  });
    
  test('1 is 1', () => {
    expect(1).toBe(1);
    ShortcutManager.getInstance().register({targetView : "", onActivated : "", actionKey:""});
    });
    
    test('[1,2,3] is [1,2,3]', () => {
      expect([1,2,3]).toEqual(1);
    });
  })



describe("shortcut activate test", ()=>{


})