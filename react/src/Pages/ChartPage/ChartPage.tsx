import React, { useEffect, useMemo, useState } from 'react';
import {
    AppBar,
    Autocomplete,
    Box,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import debounce from 'lodash.debounce';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraph';
import { DetailCard } from '../../Components';
import { groupBy, uniqueBy } from '../../util/util';
import getModel, { ModelEntity } from '../../data/model';
import { ForceGraph, PackChart } from '../../Visualizations';
import { getEntityId, makeTreeStratify, mapTree } from '../../util';

const ChartPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [detailSelection, setDetailSelection] = useState<
        HierarchyNode<ModelEntity>[]
    >([]);
    const [model, setModel] = useState<ModelEntity[]>();
    const [root, setRoot] = useState<ModelEntity>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);
    const [tree0, setTree0] = useState<HierarchyNode<ModelEntity>>();

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
            setRoot(model.find(m => m.type === 'institution'));
        };
        _getModel();
    }, []);

    /* base tree */
    useEffect(() => {
        if (model && root && !tree0) {
            setTree0(makeTreeStratify(model, root));
        }
    }, [model, root, tree0]);

    /* tree with latest root */
    const _tree = useMemo(() => {
        if (tree0 && root) {
            return tree0.find(n => n.id === getEntityId(root));
        }
    }, [tree0, root]);

    /* tree with `selected` attribute */
    const tree = useMemo(() => {
        if (_tree) {
            const selectedMap = (selected || []).reduce<
                Record<string, boolean>
            >(
                (acc, curr) => ({
                    ...acc,
                    [`${curr.type}-${curr.id}`]: true,
                }),
                {}
            );

            return mapTree(_tree, t => ({
                ...t,
                selected: selectedMap[getEntityId(t.data)],
            }));
        }
    }, [selected, _tree]);

    /* don't pass in nodes b/c autocomplete converts to JSON and you'll get circular errors */
    const options = useMemo(() => {
        if (tree) {
            return tree
                ?.descendants()
                .filter(uniqueBy(d => d.data.name))
                .map(v => v.data)
                .sort((a, b) =>
                    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
                );
        } else {
            return [];
        }
    }, [tree]);

    const nameMap = useMemo(() => {
        if (model) {
            return groupBy(model, 'name');
        } else {
            return {};
        }
    }, [model]);

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
                <Grid container justifyContent="center" sx={{ marginTop: 3 }}>
                    {model && <PackChart entities={model} />}
                </Grid>
            )}
            {activeTab === 0 && (
                <Grid container direction="row" item>
                    <Grid item xs={9}>
                        {tree && <ForceGraph tree={tree} />}
                    </Grid>
                    <Grid item xs={3} container direction="column" spacing={5}>
                        <Grid container direction="column" item spacing={2}>
                            <Grid item>
                                <FormControl fullWidth>
                                    <InputLabel>Set Root</InputLabel>
                                    <Select
                                        onChange={e => {
                                            setRoot(
                                                (model || []).find(
                                                    m =>
                                                        e.target &&
                                                        getEntityId(m) ===
                                                            e.target.value
                                                )
                                            );
                                            setSelected([]);
                                            setDetailSelection([]);
                                        }}
                                        value={root ? getEntityId(root) : ''}
                                    >
                                        {(model || [])
                                            .filter(m =>
                                                [
                                                    'campus',
                                                    'institution',
                                                ].includes(m.type)
                                            )
                                            .sort()
                                            .map(m => (
                                                <MenuItem
                                                    key={m.name}
                                                    value={getEntityId(m)}
                                                >
                                                    {m.name}
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <FormControl fullWidth>
                                    <Autocomplete
                                        key={tree?.id}
                                        autoComplete
                                        clearOnEscape
                                        getOptionLabel={m => m.name}
                                        isOptionEqualToValue={(option, value) =>
                                            option.name === value.name
                                        }
                                        onChange={(event, value, reason) => {
                                            if (
                                                reason === 'selectOption' &&
                                                value
                                            ) {
                                                setDetailSelection(
                                                    tree!
                                                        .descendants()
                                                        .filter(
                                                            m =>
                                                                m.data.name ===
                                                                value.name
                                                        )
                                                );
                                            }
                                            if (reason === 'clear') {
                                                setDetailSelection([]);
                                            }
                                        }}
                                        onInputChange={debounce(
                                            (event, value) =>
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
                                                        .flatMap(
                                                            op =>
                                                                nameMap[op.name]
                                                        )
                                                ),
                                            500
                                        )}
                                        options={options}
                                        renderInput={params => (
                                            <TextField
                                                {...params}
                                                label="Search"
                                            />
                                        )}
                                    />
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Grid item>
                            {!!detailSelection.length && (
                                <DetailCard nodes={detailSelection} />
                            )}
                        </Grid>
                    </Grid>
                </Grid>
            )}
        </Grid>
    );
};

export default ChartPage;
