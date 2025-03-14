# Custom Calls

**Custom Calls** is customizable message Between *Renderer* and *Main* Process.
Its purpose is to give users discretion.





             
|Renderer| <==============>|Main|






## RendererSide API
```ts
1. window.KAWAI_API.custom.custom_callback(channel : string, args : any[])
2. window.KAWAI_API.custom.custom_recv(channel : string, callback_function : function)
3. window.KAWAI_API.custom.custom_invoke(channel : string, args : any[])
```




## Kawaikara Official Support Channel 
| Channel  |     API      | Description  |
|----------|:-------------: |:-------------:
| bg:tasks |  custom_invoke |  |
| bg:tasks:{id} |    centered   | |


