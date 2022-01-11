import React, { useEffect, useMemo, useState } from 'react';
import {
    AppBar,
    Autocomplete,
    Box,
    Grid,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import getModel, {
    Campus,
    HydratedLink,
    hydrateLinks,
    Model,
    ModelEntity,
} from './../../data/model';
import { ForceGraph, PackChart } from './../../Visualizations';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraph';
import debounce from 'lodash.debounce';
import { DetailCard } from '../../Components';
import { EntityWithLinks, isPerson, isProgram } from '../../types';

const ChartPage: React.FC<{}> = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [detailSelection, setDetailSelection] =
        useState<EntityWithLinks | null>();
    const [links, setLinks] = useState<HydratedLink[]>();
    const [model, setModel] = useState<Model>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setLinks(hydrateLinks(model));
            setModel(model);
        };
        _getModel();
    }, []);

    const options = useMemo(() => {
        if (links) {
            return links
                .flatMap(l => [
                    { ...l.child, type: l.childType },
                    { ...l.parent, type: l.parentType },
                ])
                .filter(
                    (op, i, arr) =>
                        arr.findIndex(
                            inner =>
                                //inner.id === op.id && inner.type === op.type --> will let in dupes, need to make sure programs have campus name appended
                                inner.name === op.name
                        ) === i && op.name
                );
        } else {
            return [];
        }
    }, [links]);

    return (
        <Grid container direction="column">
            <Grid item>
                <AppBar sx={{ margin: 3 }} position="static">
                    <Box padding={2}>
                        <Typography align="center" variant="h5">
                            DSI Network App
                        </Typography>
                    </Box>
                </AppBar>
            </Grid>
            <Grid item container justifyContent="center">
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab label="Tree View" />
                    <Tab label="Nested View" />
                </Tabs>
            </Grid>
            {activeTab === 1 && (
                <Grid container justifyContent="center">
                    <PackChart />
                </Grid>
            )}
            {activeTab === 0 && (
                <Grid container direction="row" item>
                    <Grid item xs={9}>
                        {model && links && (
                            <ForceGraph
                                links={links}
                                rootModel={
                                    model.campus.find(c =>
                                        c.name.includes('eorge')
                                    ) as Campus
                                }
                                rootModelType="campus"
                                selectedModels={selected}
                            />
                        )}
                    </Grid>
                    <Grid item xs={3} container direction="column" spacing={5}>
                        <Grid item>
                            <Autocomplete
                                clearOnEscape
                                getOptionLabel={option =>
                                    `${option.name}${
                                        (option as any).campus
                                            ? ` ${(option as any).campus}`
                                            : ''
                                    }`
                                }
                                isOptionEqualToValue={(option, value) =>
                                    option.name === value.name
                                }
                                onChange={(event, value, reason) => {
                                    if (
                                        reason === 'selectOption' &&
                                        value &&
                                        links
                                    ) {
                                        // pass in all links that have this value as a child so we can report the relationship
                                        setDetailSelection({
                                            entity: value as ModelEntity,
                                            links: links.filter(
                                                l =>
                                                    l.childType ===
                                                        value.type &&
                                                    l.child.id === value.id
                                            ),
                                        });
                                    }
                                    if (reason === 'clear') {
                                        setDetailSelection(null);
                                    }
                                }}
                                onInputChange={debounce(
                                    (event, value, reason) =>
                                        setSelected(
                                            options
                                                .filter(
                                                    option =>
                                                        !!value &&
                                                        option.name
                                                            .toLowerCase()
                                                            .includes(
                                                                value.toLowerCase()
                                                            )
                                                )
                                                .map(op => ({
                                                    id: op.id,
                                                    type: op.type,
                                                }))
                                        ),
                                    500
                                )}
                                options={options}
                                renderInput={params => (
                                    <TextField {...params} label="Search" />
                                )}
                            />
                        </Grid>
                        <Grid item>
                            {!!detailSelection && (
                                <DetailCard item={detailSelection} />
                            )}
                        </Grid>
                    </Grid>
                </Grid>
            )}
        </Grid>
    );
};

export default ChartPage;
