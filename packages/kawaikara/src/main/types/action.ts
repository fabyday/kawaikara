
/**
 * IAction interface
 * 
 * @author FabyDay
 * @description Represents an action with an identifier and an activation method.
 */
export interface IAction{
    id : string;
    actionKeys : string[];
    activate : ()=>(void | Promise<void>);
}


