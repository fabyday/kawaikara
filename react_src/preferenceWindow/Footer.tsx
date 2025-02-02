import React, { useEffect } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import styled from '@emotion/styled';
import { config_states, shortcut_states } from './definition';

const FooterComponent = styled('div')({
    color: 'darkslategray',
    backgroundColor: '#002b45',
    width: '100%',
    position: 'fixed',
    padding : 5,
    bottom: 0,
    left: 0,
    zIndex: 100,
});

function Footer() {
    const [is_changed, changed_preference] = config_states(state=>[state.is_changed, state.changed_preference])
    const [check_dups_all] = shortcut_states(state=>[state.check_duplication_all])
    const refetch = config_states(state=>state.fetch);

    const check_f=()=>{
        //TODO
        const c = is_changed() ;
        const not_dup = !check_dups_all();
        // console.log("c",c)
        // console.log("b",b)
        // return c&&b;
        return (c && not_dup);
    }

    const enable_style =  {color :"white", background : "#0063cc", border : '1px solid black'} as any;
    const disable_style = {color :"white",background : "gray"}

    return (
        <FooterComponent>
            <Grid
                container
                justifyContent={'flex-end'}
                columnGap={1}
                columns={12}>
                <Grid xs={6} item>
                    <Box columnGap={1} display="flex" justifyContent="center">
                        <Button
                            variant="contained"
                            style = {enable_style}
                            onClick={() => {
                                if(check_f()){
                                    // console.log("ik")
                                    window.KAWAI_API.preference.save_and_close();
                                }else{
                                    window.KAWAI_API.preference.close();
                                }
                            }}>
                            OK
                        </Button>
                        <Button
                            variant="contained"
                            style={enable_style}
                            onClick={() => {
                                window.KAWAI_API.preference.close();
                            }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            style={check_f() ? enable_style  :disable_style}
                            onClick={async () => {
                                if(check_f()){
                                    if(await window.KAWAI_API.preference.apply_modified_preference(changed_preference)){
                                        refetch();
                                    }

                                }
                            }}
                            disabled={!check_f()}>
                            apply
                        </Button>
                    </Box>
                </Grid>
            </Grid>
        </FooterComponent>
    );
}

export default Footer;
